import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlatformMetrics() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      newUsersLast24h,
      newUsersLast7d,
      totalPosts,
      postsLast24h,
      postsLast7d,
      commentsLast24h,
      commentsLast7d,
      reactionsLast24h,
      resolvedReports,
      pendingReports,
      communities,
      totalBlocks,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, createdAt: { gte: last24h } } }),
      this.prisma.user.count({ where: { deletedAt: null, createdAt: { gte: last7d } } }),
      this.prisma.post.count({ where: { deletedAt: null } }),
      this.prisma.post.count({ where: { deletedAt: null, createdAt: { gte: last24h } } }),
      this.prisma.post.count({ where: { deletedAt: null, createdAt: { gte: last7d } } }),
      this.prisma.comment.count({ where: { deletedAt: null, createdAt: { gte: last24h } } }),
      this.prisma.comment.count({ where: { deletedAt: null, createdAt: { gte: last7d } } }),
      this.prisma.reaction.count({ where: { createdAt: { gte: last24h } } }),
      this.prisma.report.findMany({
        where: { resolvedAt: { not: null } },
        take: 100,
      }),
      this.prisma.report.count({
        where: { status: { in: ['RECEIVED', 'UNDER_REVIEW'] as any } },
      }),
      this.prisma.community.findMany({
        where: { status: 'ACTIVE' },
        include: { _count: { select: { posts: true, members: true } } },
      }),
      this.prisma.block.count(),
    ]);

    const recentActiveUsers = await this.prisma.user.count({
      where: { status: 'ACTIVE', deletedAt: null, updatedAt: { gte: last30d } },
    });

    // Average moderation resolution time
    let avgResolutionMinutes = 0;
    if (resolvedReports.length > 0) {
      const totalMs = resolvedReports.reduce((acc, r) => {
        if (!r.resolvedAt) return acc;
        return acc + (new Date(r.resolvedAt).getTime() - new Date(r.createdAt).getTime());
      }, 0);
      avgResolutionMinutes = Math.round(totalMs / resolvedReports.length / 60000);
    }

    // Post categories breakdown
    const categoryBreakdown = await this.prisma.post.groupBy({
      by: ['category'],
      where: { deletedAt: null, status: 'PUBLISHED' },
      _count: { id: true },
    });

    // Reaction type breakdown (last 7d)
    const reactionBreakdown = await this.prisma.reaction.groupBy({
      by: ['reactionType'],
      where: { createdAt: { gte: last7d } },
      _count: { id: true },
    });

    return {
      // User metrics
      total_users: totalUsers,
      active_users: activeUsers,
      dau_estimate: activeUsers,
      mau_estimate: recentActiveUsers,
      new_users_24h: newUsersLast24h,
      new_users_7d: newUsersLast7d,

      // Content metrics
      total_posts: totalPosts,
      posts_24h: postsLast24h,
      posts_7d: postsLast7d,
      comments_24h: commentsLast24h,
      comments_7d: commentsLast7d,
      reactions_24h: reactionsLast24h,

      // Engagement
      total_blocks: totalBlocks,

      // Safety metrics
      pending_reports: pendingReports,
      avg_moderation_response_minutes: avgResolutionMinutes,

      // Content composition
      post_category_breakdown: categoryBreakdown.map((c) => ({
        category: c.category,
        count: typeof (c as any)._count === 'object' ? ((c as any)._count?.id ?? 0) : ((c as any)._count ?? 0),
      })),

      // Reaction distribution (last 7d)
      reaction_type_breakdown: reactionBreakdown.map((r) => ({
        reaction_type: r.reactionType,
        count: typeof (r as any)._count === 'object' ? ((r as any)._count?.id ?? 0) : ((r as any)._count ?? 0),
      })),

      // City / community breakdown
      city_breakdown: communities
        .filter((c) => c.type === 'CITY')
        .map((c) => ({
          id: c.id,
          city: c.city ?? c.name,
          posts: (c as any)._count?.posts ?? 0,
          members: (c as any)._count?.members ?? 0,
        })),

      // Top communities by post volume (all types)
      top_communities: communities
        .sort((a, b) => ((b as any)._count?.posts ?? 0) - ((a as any)._count?.posts ?? 0))
        .slice(0, 10)
        .map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          posts: (c as any)._count?.posts ?? 0,
          members: (c as any)._count?.members ?? 0,
        })),
    };
  }

  async getCommunityGrowth(communityId: string) {
    const now = new Date();
    const periods = [
      { label: 'last_7d', since: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
      { label: 'last_30d', since: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
    ];

    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      include: { _count: { select: { posts: true, members: true } } },
    });

    if (!community) {
      return null;
    }

    const stats = await Promise.all(
      periods.map(async (p) => {
        const [newPosts, newMembers] = await Promise.all([
          this.prisma.post.count({
            where: { communityId, deletedAt: null, createdAt: { gte: p.since } },
          }),
          this.prisma.communityMember.count({
            where: { communityId },
          }),
        ]);
        return { period: p.label, new_posts: newPosts, new_members: newMembers };
      }),
    );

    return {
      community_id: communityId,
      name: community.name,
      type: community.type,
      total_posts: (community as any)._count?.posts ?? 0,
      total_members: (community as any)._count?.members ?? 0,
      growth: stats,
    };
  }

  private recentEventKeys = new Set<string>();

  ingestAnalyticsEvent(
    userId: string,
    eventName: string,
    properties: Record<string, any> = {},
  ) {
    const now = Date.now();
    const eventKey = `${userId}:${eventName}:${JSON.stringify(properties)}`;

    // Deduplication check (5-second window)
    if (this.recentEventKeys.has(eventKey)) {
      return { status: 'DEDUPLICATED', event_name: eventName };
    }
    this.recentEventKeys.add(eventKey);
    setTimeout(() => this.recentEventKeys.delete(eventKey), 5000);

    // Sensitive field rejection & allowlist filtering
    const sensitiveKeys = ['password', 'otp', 'phone', 'email', 'lat', 'lng', 'aadhaar', 'address'];
    const sanitizedProps: Record<string, any> = {};

    for (const [k, v] of Object.entries(properties)) {
      if (sensitiveKeys.includes(k.toLowerCase())) {
        sanitizedProps[k] = '[REDACTED_PRIVACY]';
      } else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        sanitizedProps[k] = v;
      }
    }

    return {
      status: 'INGESTED',
      event_name: eventName,
      user_id: userId,
      properties: sanitizedProps,
      timestamp: new Date().toISOString(),
    };
  }
}
