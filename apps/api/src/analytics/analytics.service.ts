import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlatformMetrics() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      totalPosts,
      postsLast24h,
      commentsLast24h,
      reactionsLast24h,
      resolvedReports,
      pendingReports,
      communities,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      this.prisma.post.count({ where: { deletedAt: null } }),
      this.prisma.post.count({ where: { deletedAt: null, createdAt: { gte: last24h } } }),
      this.prisma.comment.count({ where: { deletedAt: null, createdAt: { gte: last24h } } }),
      this.prisma.reaction.count({ where: { createdAt: { gte: last24h } } }),
      this.prisma.report.findMany({
        where: { resolvedAt: { not: null } },
        take: 100,
      }),
      this.prisma.report.count({ where: { status: { in: ['RECEIVED', 'UNDER_REVIEW'] as any } } }),
      this.prisma.community.findMany({
        where: { status: 'ACTIVE' },
        include: { _count: { select: { posts: true, members: true } } },
      }),
    ]);

    const recentActiveUsers = await this.prisma.user.count({
      where: { status: 'ACTIVE', deletedAt: null, updatedAt: { gte: last30d } },
    });

    let avgResolutionMinutes = 0;
    if (resolvedReports.length > 0) {
      const totalMs = resolvedReports.reduce((acc, r) => {
        if (!r.resolvedAt) return acc;
        return acc + (new Date(r.resolvedAt).getTime() - new Date(r.createdAt).getTime());
      }, 0);
      avgResolutionMinutes = Math.round(totalMs / resolvedReports.length / 60000);
    }

    return {
      dau_estimate: activeUsers,
      mau_estimate: recentActiveUsers,
      total_users: totalUsers,
      total_posts: totalPosts,
      posts_last_24h: postsLast24h,
      comments_last_24h: commentsLast24h,
      reactions_last_24h: reactionsLast24h,
      pending_reports: pendingReports,
      avg_moderation_response_minutes: avgResolutionMinutes,
      city_breakdown: communities
        .filter((c) => c.type === 'CITY')
        .map((c) => ({
          id: c.id,
          city: c.city ?? c.name,
          posts: (c as any)._count?.posts ?? 0,
          members: (c as any)._count?.members ?? 0,
        })),
    };
  }
}
