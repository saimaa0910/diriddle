import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import {
  AdminRoleType,
  AppealStatus,
  CommentStatus,
  CommunityStatus,
  CommunityType,
  ModerationActionType,
  PostStatus,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ModerationService, TakeModerationActionInput } from '../moderation/moderation.service';
import { AuthService } from '../auth/auth.service';
import { RequestUser } from '../common/decorators/current-user.decorator';

export interface AdminLoginInput {
  email?: string;
  phone?: string;
  identifier?: string;
  password?: string;
  otp?: string;
}

export interface CreateCommunityInput {
  name: string;
  slug?: string;
  type: CommunityType;
  city?: string;
  state?: string;
  geo_cell?: string;
  geoCell?: string;
  status?: CommunityStatus;
}

export interface AdminReportActionInput {
  action_type: ModerationActionType;
  reason: string;
  notes?: string;
  target_type?: 'POST' | 'COMMENT' | 'USER' | 'REPORT';
  target_id?: string;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderationService: ModerationService,
    private readonly authService: AuthService,
  ) {}

  async getOverview() {
    const [
      totalUsers,
      activeUsers,
      totalPosts,
      activePosts,
      totalReports,
      pendingReports,
      activeCities,
      pendingAppeals,
      recentReports,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      this.prisma.post.count({ where: { deletedAt: null } }),
      this.prisma.post.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
      this.prisma.report.count(),
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

    const dau = activeUsers;

    return {
      dau,
      kpis: {
        total_users: totalUsers,
        total_posts: totalPosts,
        active_posts: activePosts,
        total_reports: totalReports,
        pending_reports: pendingReports,
        active_cities: activeCities,
        pending_appeals: pendingAppeals,
        dau,
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

  async getReports(
    filters: { status?: string; priority?: string; reason?: string },
    requester?: RequestUser | string,
  ) {
    const isSuperAdmin =
      typeof requester === 'string'
        ? requester === 'SUPER_ADMIN'
        : requester?.adminRole?.role === 'SUPER_ADMIN';

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
        reporter_id: isSuperAdmin ? r.reporterId : null,
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

  async adminLogin(dto: AdminLoginInput) {
    const candidates: string[] = [];
    if (dto.identifier) candidates.push(dto.identifier.trim());
    if (dto.phone) candidates.push(dto.phone.trim());
    if (dto.email) candidates.push(dto.email.trim());

    if (candidates.length === 0) {
      throw new UnauthorizedException({
        error: 'INVALID_ADMIN_CREDENTIALS',
        message: 'Invalid administrative credentials or expired role',
      });
    }

    const searchValues = new Set<string>();
    for (const raw of candidates) {
      searchValues.add(raw);
      if (raw.includes('@')) {
        const lower = raw.toLowerCase();
        searchValues.add(lower);
        searchValues.add(`email:${lower}`);
      } else {
        const digits = raw.replace(/\s+/g, '');
        searchValues.add(digits);
        searchValues.add(`phone:${digits}`);
        if (!digits.startsWith('+91') && /^\d{10}$/.test(digits)) {
          searchValues.add(`phone:+91${digits}`);
          searchValues.add(`+91${digits}`);
        }
      }
    }

    let user: any = null;
    for (const val of searchValues) {
      user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { authId: val },
            { id: val },
          ],
        },
        include: { adminRole: true },
      });
      if (user) break;
    }

    if (!user || user.deletedAt || user.status === 'DELETED' || user.status === 'SUSPENDED') {
      throw new UnauthorizedException({
        error: 'INVALID_ADMIN_CREDENTIALS',
        message: 'Invalid administrative credentials or expired role',
      });
    }

    if (!user.adminRole) {
      throw new UnauthorizedException({
        error: 'INVALID_ADMIN_CREDENTIALS',
        message: 'Invalid administrative credentials or expired role',
      });
    }

    if (user.adminRole.expiresAt && new Date(user.adminRole.expiresAt) <= new Date()) {
      throw new UnauthorizedException({
        error: 'INVALID_ADMIN_CREDENTIALS',
        message: 'Invalid administrative credentials or expired role',
      });
    }

    const tokens = await this.authService.issueTokens(user.authId, user.id);

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type ?? 'Bearer',
      expires_in: tokens.expires_in ?? 900,
      admin: {
        id: user.id,
        role: user.adminRole.role,
      },
    };
  }

  async createCommunity(actorId: string, dto: CreateCommunityInput) {
    const slug =
      dto.slug?.trim() ||
      dto.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    const community = await this.prisma.community.create({
      data: {
        name: dto.name,
        slug,
        type: dto.type,
        city: dto.city ?? null,
        state: dto.state ?? null,
        geoCell: dto.geo_cell ?? dto.geoCell ?? null,
        status: dto.status ?? 'ACTIVE',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'ADMIN_COMMUNITY_CREATE',
        resourceType: 'COMMUNITY',
        resourceId: community.id,
        beforeState: undefined,
        afterState: { id: community.id, name: community.name, slug: community.slug, status: community.status },
      },
    });

    return community;
  }

  async updatePostStatus(actorId: string, postId: string, status: PostStatus, reason?: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) {
      throw new NotFoundException({
        error: 'POST_NOT_FOUND',
        message: 'Post not found',
      });
    }

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: { status },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'ADMIN_POST_STATUS_UPDATE',
        resourceType: 'POST',
        resourceId: postId,
        beforeState: { status: post.status },
        afterState: { status: updated.status, reason: reason ?? null },
      },
    });

    return { id: updated.id, status: updated.status };
  }

  async updateCommentStatus(actorId: string, commentId: string, status: CommentStatus, reason?: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.deletedAt) {
      throw new NotFoundException({
        error: 'COMMENT_NOT_FOUND',
        message: 'Comment not found',
      });
    }

    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { status },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'ADMIN_COMMENT_STATUS_UPDATE',
        resourceType: 'COMMENT',
        resourceId: commentId,
        beforeState: { status: comment.status },
        afterState: { status: updated.status, reason: reason ?? null },
      },
    });

    return { id: updated.id, status: updated.status };
  }

  async handleModerationAction(
    actorId: string,
    reportId: string,
    dto: AdminReportActionInput,
    ipAddress?: string,
  ) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundException({
        error: 'REPORT_NOT_FOUND',
        message: 'Report not found',
      });
    }

    return this.moderationService.takeAction(
      actorId,
      {
        target_type: (dto.target_type ?? report.targetType) as any,
        target_id: dto.target_id ?? report.targetId,
        action_type: dto.action_type,
        reason: dto.reason,
        notes: dto.notes,
        report_id: reportId,
      },
      ipAddress,
    );
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

    if (status === 'SUSPENDED' || status === 'DELETED') {
      await this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

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

  async setLegalHold(actorId: string, userId: string, enabled: boolean, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException({ error: 'USER_NOT_FOUND', message: 'User not found' });
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { legalHold: enabled } as any,
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: enabled ? 'LEGAL_HOLD_APPLIED' : 'LEGAL_HOLD_RELEASED',
        resourceType: 'USER',
        resourceId: userId,
        beforeState: { legalHold: (user as any).legalHold ?? false },
        afterState: { legalHold: enabled, reason: reason ?? null },
      },
    });

    return { id: updated.id, legal_hold: enabled };
  }

  async rollbackAuditAction(actorId: string, auditLogId: string) {
    const log = await this.prisma.auditLog.findUnique({ where: { id: auditLogId } });
    if (!log) {
      throw new NotFoundException({ error: 'AUDIT_LOG_NOT_FOUND', message: 'Audit log entry not found' });
    }

    if (!log.beforeState || typeof log.beforeState !== 'object') {
      throw new BadRequestException({ error: 'CANNOT_ROLLBACK', message: 'No before-state snapshot available for rollback' });
    }

    const before = log.beforeState as any;
    if (log.resourceType === 'USER' && before.status) {
      await this.prisma.user.update({
        where: { id: log.resourceId },
        data: { status: before.status },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'ADMIN_ACTION_ROLLBACK',
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        beforeState: (log.afterState as any) ?? {},
        afterState: (log.beforeState as any) ?? {},
      },
    });

    return { rolled_back: true, original_action: log.action, resource_id: log.resourceId };
  }

  async grantAdminRole(
    actorId: string,
    targetUserId: string,
    role: AdminRoleType,
    scope: string = 'PLATFORM',
    scopeId?: string,
    expiresAt?: Date,
  ) {
    const actorRole = await this.prisma.adminRole.findUnique({ where: { userId: actorId } });
    if (actorRole?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException({
        error: 'SUPER_ADMIN_REQUIRED',
        message: 'Only super administrators can grant administrative roles',
      });
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser || targetUser.deletedAt) {
      throw new NotFoundException({ error: 'USER_NOT_FOUND', message: 'Target user not found' });
    }

    const granted = await this.prisma.adminRole.upsert({
      where: { userId: targetUserId },
      create: {
        userId: targetUserId,
        role,
        scope,
        scopeId: scopeId ?? null,
        expiresAt: expiresAt ?? null,
      },
      update: {
        role,
        scope,
        scopeId: scopeId ?? null,
        expiresAt: expiresAt ?? null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'ADMIN_ROLE_GRANTED',
        resourceType: 'ADMIN_ROLE',
        resourceId: targetUserId,
        afterState: { role: granted.role, scope: granted.scope, expiresAt: granted.expiresAt },
      },
    });

    return {
      user_id: granted.userId,
      role: granted.role,
      scope: granted.scope,
      granted_at: granted.grantedAt,
      expires_at: granted.expiresAt,
    };
  }

  async revokeAdminRole(actorId: string, targetUserId: string) {
    const actorRole = await this.prisma.adminRole.findUnique({ where: { userId: actorId } });
    if (actorRole?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException({
        error: 'SUPER_ADMIN_REQUIRED',
        message: 'Only super administrators can revoke administrative roles',
      });
    }

    await this.prisma.adminRole.deleteMany({
      where: { userId: targetUserId },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'ADMIN_ROLE_REVOKED',
        resourceType: 'ADMIN_ROLE',
        resourceId: targetUserId,
      },
    });

    return { success: true, message: 'Admin role revoked successfully' };
  }

  async assignReport(moderatorId: string, reportId: string) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundException({ error: 'REPORT_NOT_FOUND', message: 'Report not found' });
    }

    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: { status: 'UNDER_REVIEW' },
    });

    return {
      id: updated.id,
      assigned_to: moderatorId,
      status: updated.status,
    };
  }

  async getDetailedHealth() {
    const [userCount, postCount, communityCount, pendingReports] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.post.count({ where: { deletedAt: null, status: 'PUBLISHED' } }),
      this.prisma.community.count({ where: { status: 'ACTIVE' } }),
      this.prisma.report.count({ where: { status: { in: ['RECEIVED', 'UNDER_REVIEW'] as any } } }),
    ]);

    return {
      status: 'UP',
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date(),
      metrics: {
        total_users: userCount,
        active_posts: postCount,
        active_communities: communityCount,
        pending_reports: pendingReports,
      },
      database: {
        connected: true,
      },
    };
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
