import { Injectable, NotFoundException } from '@nestjs/common';
import { AppealStatus, CommunityStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ModerationService, TakeModerationActionInput } from '../moderation/moderation.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderationService: ModerationService,
  ) {}

  async getOverview() {
    const [
      totalUsers,
      activePosts,
      pendingReports,
      activeCities,
      pendingAppeals,
      recentReports,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.post.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
      this.prisma.report.count({
        where: { status: { in: ['RECEIVED', 'UNDER_REVIEW'] as any } },
      }),
      this.prisma.community.count({ where: { type: 'CITY', status: 'ACTIVE' } }),
      this.prisma.moderationAppeal.count({ where: { status: 'PENDING' } }),
      this.prisma.report.findMany({
        where: { status: { in: ['RECEIVED', 'UNDER_REVIEW'] as any } },
        orderBy: { createdAt: 'asc' },
        take: 10,
      }),
    ]);

    return {
      kpis: {
        total_users: totalUsers,
        active_posts: activePosts,
        pending_reports: pendingReports,
        active_cities: activeCities,
        pending_appeals: pendingAppeals,
      },
      priority_reports: recentReports.map((r) => ({
        id: r.id,
        target_type: r.targetType,
        target_id: r.targetId,
        reason: r.reason,
        priority: r.priority,
        status: r.status,
        created_at: r.createdAt,
      })),
    };
  }

  async getReports(filters: { status?: string; priority?: string; reason?: string }) {
    const reports = await this.prisma.report.findMany({
      where: {
        ...(filters.status ? { status: filters.status as any } : {}),
        ...(filters.priority ? { priority: filters.priority } : {}),
        ...(filters.reason ? { reason: filters.reason as any } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      data: reports.map((r) => ({
        id: r.id,
        reporter_id: r.reporterId,
        target_type: r.targetType,
        target_id: r.targetId,
        reason: r.reason,
        description: r.description,
        status: r.status,
        priority: r.priority,
        created_at: r.createdAt,
        resolved_at: r.resolvedAt,
      })),
    };
  }

  async executeModerationAction(
    moderatorId: string,
    input: TakeModerationActionInput,
    ipAddress?: string,
  ) {
    return this.moderationService.takeAction(moderatorId, input, ipAddress);
  }

  async listPostsForModeration(status?: string) {
    const posts = await this.prisma.post.findMany({
      where: {
        deletedAt: null,
        ...(status ? { status: status as any } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { anonymousIdentity: true, community: true },
    });

    return {
      data: posts.map((p) => ({
        id: p.id,
        anonymous_name: p.anonymousIdentity?.displayCode ?? 'Anonymous',
        community_name: p.community?.name ?? 'Unknown',
        category: p.category,
        content: p.content,
        status: p.status,
        created_at: p.createdAt,
      })),
    };
  }

  async listCommentsForModeration(status?: string) {
    const comments = await this.prisma.comment.findMany({
      where: {
        deletedAt: null,
        ...(status ? { status: status as any } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { anonymousIdentity: true },
    });

    return {
      data: comments.map((c) => ({
        id: c.id,
        post_id: c.postId,
        anonymous_name: c.anonymousIdentity?.displayCode ?? 'Anonymous',
        content: c.content,
        status: c.status,
        created_at: c.createdAt,
      })),
    };
  }

  async listUsersAnonymized() {
    // Deliberately excludes authId / phone / email PII from moderation/admin listing
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { adminRole: true },
    });

    return {
      data: users.map((u) => ({
        id: u.id,
        status: u.status,
        age_verified: u.ageVerified,
        admin_role: u.adminRole?.role ?? null,
        created_at: u.createdAt,
      })),
    };
  }

  async updateUserStatus(actorId: string, userId: string, status: UserStatus, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException({ error: 'USER_NOT_FOUND', message: 'User not found' });
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'ADMIN_USER_STATUS_UPDATE',
        resourceType: 'USER',
        resourceId: userId,
        beforeState: { status: user.status },
        afterState: { status: updated.status, reason: reason ?? null },
      },
    });

    return { id: updated.id, status: updated.status };
  }

  async listCommunities() {
    const communities = await this.prisma.community.findMany({
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { members: true, posts: true } } },
    });

    return {
      data: communities.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        type: c.type,
        city: c.city,
        state: c.state,
        status: c.status,
        member_count: (c as any)._count?.members ?? 0,
        post_count: (c as any)._count?.posts ?? 0,
      })),
    };
  }

  async updateCommunityStatus(actorId: string, communityId: string, status: CommunityStatus) {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) {
      throw new NotFoundException({
        error: 'COMMUNITY_NOT_FOUND',
        message: 'Community not found',
      });
    }

    const updated = await this.prisma.community.update({
      where: { id: communityId },
      data: { status },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'ADMIN_COMMUNITY_STATUS_UPDATE',
        resourceType: 'COMMUNITY',
        resourceId: communityId,
        beforeState: { status: community.status },
        afterState: { status: updated.status },
      },
    });

    return { id: updated.id, name: updated.name, status: updated.status };
  }

  async listAppeals(status?: AppealStatus) {
    return this.moderationService.listAppeals(status);
  }

  async resolveAppeal(
    reviewerId: string,
    appealId: string,
    status: 'APPROVED' | 'REJECTED',
    notes?: string,
  ) {
    return this.moderationService.resolveAppeal(reviewerId, appealId, status, notes);
  }

  async getAuditLogs() {
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      data: logs.map((l) => ({
        id: l.id,
        actor_id: l.actorId,
        action: l.action,
        resource_type: l.resourceType,
        resource_id: l.resourceId,
        before_state: l.beforeState,
        after_state: l.afterState,
        created_at: l.createdAt,
      })),
    };
  }
}
