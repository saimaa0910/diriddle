import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommunityRoleType, CommunityType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { BlocksService } from '../blocks/blocks.service';
import { buildPaginatedResponse, decodeCursor } from '../common/utils/pagination.util';
import { CreateCommunityDto } from './dto/create-community.dto';

@Injectable()
export class CommunitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocksService: BlocksService,
  ) {}

  async create(userId: string, dto: CreateCommunityDto) {
    const slug = dto.slug
      ? dto.slug.toLowerCase()
      : dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const existing = await this.prisma.community.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException({
        error: 'COMMUNITY_SLUG_EXISTS',
        message: `Community slug '${slug}' is already taken`,
      });
    }

    const community = await this.prisma.community.create({
      data: {
        name: dto.name,
        slug,
        type: dto.type,
        city: dto.city ?? null,
        state: dto.state ?? null,
        geoCell: dto.geo_cell ?? null,
        ownerId: userId,
        description: dto.description ?? null,
        avatarUrl: dto.avatar_url ?? null,
        coverUrl: dto.cover_url ?? null,
        isPrivate: dto.is_private ?? false,
        maxMembers: dto.max_members ?? null,
        status: 'ACTIVE',
      },
    });

    // Automatically make creator the OWNER with active membership
    await Promise.all([
      this.prisma.communityRole.create({
        data: {
          communityId: community.id,
          userId,
          role: CommunityRoleType.OWNER,
          permissions: ['ALL'],
          grantedById: userId,
        },
      }),
      this.prisma.communityMember.create({
        data: {
          userId,
          communityId: community.id,
          status: 'ACTIVE',
        },
      }),
    ]);

    return {
      id: community.id,
      name: community.name,
      slug: community.slug,
      type: community.type,
      city: community.city,
      is_private: community.isPrivate,
      is_owner: true,
      created_at: community.createdAt,
    };
  }

  async findAll(
    userId: string,
    query: {
      city?: string;
      state?: string;
      type?: string;
      q?: string;
      cursor?: string;
      limit?: number;
    },
  ) {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const decoded = decodeCursor(query.cursor);

    const where: Record<string, any> = {
      status: 'ACTIVE',
      ...(query.city ? { city: { contains: query.city, mode: 'insensitive' } } : {}),
      ...(query.state ? { state: { contains: query.state, mode: 'insensitive' } } : {}),
      ...(query.type ? { type: query.type as CommunityType } : {}),
      ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
      ...(decoded ? { createdAt: { lt: new Date(decoded.createdAt) } } : {}),
    };

    const [communities, memberships] = await Promise.all([
      this.prisma.community.findMany({
        where,
        take: limit + 1,
        orderBy: [{ createdAt: 'desc' }],
        include: { _count: { select: { members: true, posts: true } } },
      }),
      this.prisma.communityMember.findMany({
        where: { userId, status: 'ACTIVE' },
        select: { communityId: true },
      }),
    ]);

    const joinedIds = new Set(memberships.map((m) => m.communityId));

    const mapped = communities.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      type: c.type,
      city: c.city,
      state: c.state,
      description: c.description,
      avatar_url: c.avatarUrl,
      cover_url: c.coverUrl,
      is_private: c.isPrivate,
      status: c.status,
      member_count: (c as any)._count?.members ?? 0,
      post_count: (c as any)._count?.posts ?? 0,
      is_member: joinedIds.has(c.id),
      created_at: c.createdAt,
    }));

    return buildPaginatedResponse(mapped, limit, (item) => ({
      id: item.id,
      createdAt: new Date(item.created_at).toISOString(),
    }));
  }

  async findOne(id: string, userId: string) {
    const c = await this.prisma.community.findUnique({
      where: { id },
      include: { _count: { select: { members: true, posts: true } } },
    });
    if (!c) {
      throw new NotFoundException({
        error: 'COMMUNITY_NOT_FOUND',
        message: 'Community not found',
      });
    }

    const [membership, userRole] = await Promise.all([
      this.prisma.communityMember.findUnique({
        where: { userId_communityId: { userId, communityId: id } },
      }),
      this.prisma.communityRole.findUnique({
        where: { communityId_userId: { communityId: id, userId } },
      }),
    ]);

    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      type: c.type,
      city: c.city,
      state: c.state,
      description: c.description,
      avatar_url: c.avatarUrl,
      cover_url: c.coverUrl,
      is_private: c.isPrivate,
      status: c.status,
      member_count: (c as any)._count?.members ?? 0,
      post_count: (c as any)._count?.posts ?? 0,
      is_member: membership?.status === 'ACTIVE',
      is_owner: c.ownerId === userId,
      role: userRole?.role ?? (c.ownerId === userId ? 'OWNER' : 'MEMBER'),
      created_at: c.createdAt,
    };
  }

  async join(communityId: string, userId: string, message?: string) {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community || community.status !== 'ACTIVE') {
      throw new NotFoundException({
        error: 'COMMUNITY_NOT_FOUND',
        message: 'Community not found or inactive',
      });
    }

    // Check ban status
    const ban = await this.prisma.communityBan.findFirst({
      where: {
        communityId,
        userId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    if (ban) {
      throw new ForbiddenException({
        error: 'COMMUNITY_BANNED',
        message: 'You are banned from this community',
      });
    }

    // If private, submit join request
    if (community.isPrivate) {
      const existingReq = await this.prisma.joinRequest.findUnique({
        where: { communityId_userId: { communityId, userId } },
      });
      if (existingReq?.status === 'PENDING') {
        return { status: 'REQUEST_PENDING', message: 'Join request is pending approval' };
      }

      await this.prisma.joinRequest.upsert({
        where: { communityId_userId: { communityId, userId } },
        create: {
          communityId,
          userId,
          message: message ?? null,
          status: 'PENDING',
        },
        update: {
          message: message ?? null,
          status: 'PENDING',
        },
      });

      return { status: 'REQUESTED', community_id: communityId };
    }

    // Check max members
    if (community.maxMembers) {
      const count = await this.prisma.communityMember.count({
        where: { communityId, status: 'ACTIVE' },
      });
      if (count >= community.maxMembers) {
        throw new BadRequestException({
          error: 'COMMUNITY_FULL',
          message: 'Community has reached maximum member capacity',
        });
      }
    }

    await this.prisma.communityMember.upsert({
      where: { userId_communityId: { userId, communityId } },
      create: { userId, communityId, status: 'ACTIVE' },
      update: { status: 'ACTIVE' },
    });

    return { status: 'joined', community_id: communityId };
  }

  async leave(communityId: string, userId: string) {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (community?.ownerId === userId) {
      throw new BadRequestException({
        error: 'OWNER_CANNOT_LEAVE',
        message: 'Community owner cannot leave without transferring ownership',
      });
    }

    await this.prisma.communityMember.updateMany({
      where: { userId, communityId },
      data: { status: 'LEFT' },
    });
  }

  async transferOwnership(communityId: string, currentOwnerId: string, newOwnerId: string) {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) {
      throw new NotFoundException({ error: 'COMMUNITY_NOT_FOUND', message: 'Community not found' });
    }
    if (community.ownerId !== currentOwnerId) {
      throw new ForbiddenException({
        error: 'FORBIDDEN_OWNERSHIP_TRANSFER',
        message: 'Only the current owner can transfer ownership',
      });
    }

    const targetMembership = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: newOwnerId, communityId } },
    });
    if (!targetMembership || targetMembership.status !== 'ACTIVE') {
      throw new BadRequestException({
        error: 'NEW_OWNER_NOT_ACTIVE_MEMBER',
        message: 'New owner must be an active member of the community',
      });
    }

    await this.prisma.$transaction([
      this.prisma.community.update({
        where: { id: communityId },
        data: { ownerId: newOwnerId },
      }),
      this.prisma.communityRole.upsert({
        where: { communityId_userId: { communityId, userId: newOwnerId } },
        create: {
          communityId,
          userId: newOwnerId,
          role: CommunityRoleType.OWNER,
          permissions: ['ALL'],
          grantedById: currentOwnerId,
        },
        update: { role: CommunityRoleType.OWNER, permissions: ['ALL'] },
      }),
      this.prisma.communityRole.updateMany({
        where: { communityId, userId: currentOwnerId },
        data: { role: CommunityRoleType.MODERATOR, permissions: ['MANAGE_POSTS', 'MANAGE_COMMENTS'] },
      }),
    ]);

    return { success: true, new_owner_id: newOwnerId };
  }

  async addModerator(
    communityId: string,
    actorId: string,
    targetUserId: string,
    permissions: string[] = ['MANAGE_POSTS', 'MANAGE_COMMENTS'],
  ) {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community || community.ownerId !== actorId) {
      throw new ForbiddenException({
        error: 'FORBIDDEN_MOD_MANAGEMENT',
        message: 'Only the community owner can appoint moderators',
      });
    }

    const role = await this.prisma.communityRole.upsert({
      where: { communityId_userId: { communityId, userId: targetUserId } },
      create: {
        communityId,
        userId: targetUserId,
        role: CommunityRoleType.MODERATOR,
        permissions,
        grantedById: actorId,
      },
      update: {
        role: CommunityRoleType.MODERATOR,
        permissions,
        revokedAt: null,
      },
    });

    return { id: role.id, role: role.role, permissions: role.permissions };
  }

  async removeModerator(communityId: string, actorId: string, targetUserId: string) {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community || community.ownerId !== actorId) {
      throw new ForbiddenException({
        error: 'FORBIDDEN_MOD_MANAGEMENT',
        message: 'Only the community owner can remove moderators',
      });
    }

    await this.prisma.communityRole.deleteMany({
      where: { communityId, userId: targetUserId, role: CommunityRoleType.MODERATOR },
    });

    return { removed: true, user_id: targetUserId };
  }

  async listRoles(communityId: string, requestingUserId: string) {
    const userRole = await this.prisma.communityRole.findUnique({
      where: { communityId_userId: { communityId, userId: requestingUserId } },
    });
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });

    if (!userRole && community?.ownerId !== requestingUserId) {
      throw new ForbiddenException({
        error: 'FORBIDDEN_ROLE_VIEW',
        message: 'Only community staff can view the roles list',
      });
    }

    const roles = await this.prisma.communityRole.findMany({
      where: { communityId, revokedAt: null },
    });

    return {
      data: roles.map((r) => ({
        id: r.id,
        user_id: r.userId,
        role: r.role,
        permissions: r.permissions,
        granted_at: r.grantedAt,
      })),
    };
  }

  // Join Requests
  async listJoinRequests(communityId: string, reviewerId: string, status = 'PENDING') {
    const isStaff = await this.isCommunityStaff(communityId, reviewerId);
    if (!isStaff) {
      throw new ForbiddenException({ error: 'FORBIDDEN_JOIN_REQUESTS', message: 'Staff only' });
    }

    const requests = await this.prisma.joinRequest.findMany({
      where: { communityId, status: status as any },
      orderBy: { createdAt: 'asc' },
    });

    return {
      data: requests.map((r) => ({
        id: r.id,
        user_id: r.userId,
        message: r.message,
        status: r.status,
        created_at: r.createdAt,
      })),
    };
  }

  async approveJoinRequest(communityId: string, reviewerId: string, requestId: string) {
    const isStaff = await this.isCommunityStaff(communityId, reviewerId);
    if (!isStaff) {
      throw new ForbiddenException({ error: 'FORBIDDEN_JOIN_APPROVAL', message: 'Staff only' });
    }

    const req = await this.prisma.joinRequest.findUnique({ where: { id: requestId } });
    if (!req || req.communityId !== communityId) {
      throw new NotFoundException({ error: 'REQUEST_NOT_FOUND', message: 'Join request not found' });
    }

    await this.prisma.$transaction([
      this.prisma.joinRequest.update({
        where: { id: requestId },
        data: { status: 'APPROVED', reviewedById: reviewerId },
      }),
      this.prisma.communityMember.upsert({
        where: { userId_communityId: { userId: req.userId, communityId } },
        create: { userId: req.userId, communityId, status: 'ACTIVE' },
        update: { status: 'ACTIVE' },
      }),
    ]);

    return { approved: true, request_id: requestId };
  }

  async rejectJoinRequest(communityId: string, reviewerId: string, requestId: string) {
    const isStaff = await this.isCommunityStaff(communityId, reviewerId);
    if (!isStaff) {
      throw new ForbiddenException({ error: 'FORBIDDEN_JOIN_APPROVAL', message: 'Staff only' });
    }

    await this.prisma.joinRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED', reviewedById: reviewerId },
    });

    return { rejected: true, request_id: requestId };
  }

  // Community Rules
  async createRule(communityId: string, actorId: string, dto: { title: string; description?: string }) {
    const isStaff = await this.isCommunityStaff(communityId, actorId);
    if (!isStaff) {
      throw new ForbiddenException({ error: 'FORBIDDEN_RULE_MANAGEMENT', message: 'Staff only' });
    }

    const count = await this.prisma.communityRule.count({ where: { communityId } });
    const rule = await this.prisma.communityRule.create({
      data: {
        communityId,
        title: dto.title,
        description: dto.description ?? null,
        orderIndex: count + 1,
        version: 1,
      },
    });

    return {
      id: rule.id,
      title: rule.title,
      description: rule.description,
      order_index: rule.orderIndex,
      version: rule.version,
    };
  }

  async listRules(communityId: string) {
    const rules = await this.prisma.communityRule.findMany({
      where: { communityId, deletedAt: null },
      orderBy: { orderIndex: 'asc' },
    });

    return {
      data: rules.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        order_index: r.orderIndex,
        version: r.version,
      })),
    };
  }

  async deleteRule(communityId: string, actorId: string, ruleId: string) {
    const isStaff = await this.isCommunityStaff(communityId, actorId);
    if (!isStaff) {
      throw new ForbiddenException({ error: 'FORBIDDEN_RULE_MANAGEMENT', message: 'Staff only' });
    }

    await this.prisma.communityRule.update({
      where: { id: ruleId },
      data: { deletedAt: new Date() },
    });

    return { deleted: true, rule_id: ruleId };
  }

  // Community Bans
  async banMember(
    communityId: string,
    moderatorId: string,
    targetUserId: string,
    dto: { reason?: string; expiresAt?: Date; notes?: string },
  ) {
    const isStaff = await this.isCommunityStaff(communityId, moderatorId);
    if (!isStaff) {
      throw new ForbiddenException({ error: 'FORBIDDEN_BAN', message: 'Staff only' });
    }

    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (community?.ownerId === targetUserId) {
      throw new BadRequestException({ error: 'CANNOT_BAN_OWNER', message: 'Cannot ban the community owner' });
    }

    const ban = await this.prisma.communityBan.create({
      data: {
        communityId,
        userId: targetUserId,
        bannedById: moderatorId,
        reason: dto.reason ?? null,
        expiresAt: dto.expiresAt ?? null,
        notes: dto.notes ?? null,
        isActive: true,
      },
    });

    await this.prisma.communityMember.updateMany({
      where: { communityId, userId: targetUserId },
      data: { status: 'BANNED' },
    });

    return {
      banned: true,
      ban_id: ban.id,
      user_id: targetUserId,
      expires_at: ban.expiresAt,
    };
  }

  async unbanMember(communityId: string, moderatorId: string, targetUserId: string) {
    const isStaff = await this.isCommunityStaff(communityId, moderatorId);
    if (!isStaff) {
      throw new ForbiddenException({ error: 'FORBIDDEN_UNBAN', message: 'Staff only' });
    }

    await this.prisma.$transaction([
      this.prisma.communityBan.updateMany({
        where: { communityId, userId: targetUserId, isActive: true },
        data: { isActive: false },
      }),
      this.prisma.communityMember.updateMany({
        where: { communityId, userId: targetUserId },
        data: { status: 'LEFT' },
      }),
    ]);

    return { unbanned: true, user_id: targetUserId };
  }

  async listBans(communityId: string, moderatorId: string) {
    const isStaff = await this.isCommunityStaff(communityId, moderatorId);
    if (!isStaff) {
      throw new ForbiddenException({ error: 'FORBIDDEN_BAN_LIST', message: 'Staff only' });
    }

    const bans = await this.prisma.communityBan.findMany({
      where: { communityId, isActive: true },
      orderBy: { bannedAt: 'desc' },
    });

    return {
      data: bans.map((b) => ({
        id: b.id,
        user_id: b.userId,
        reason: b.reason,
        banned_at: b.bannedAt,
        expires_at: b.expiresAt,
      })),
    };
  }

  async getFeed(
    communityId: string,
    userId: string,
    pagination: { cursor?: string; limit?: number },
  ) {
    const limit = Math.min(Math.max(pagination.limit ?? 20, 1), 50);
    const decoded = decodeCursor(pagination.cursor);
    const blockedIds = await this.blocksService.getBlockedUserIds(userId);

    const posts = await this.prisma.post.findMany({
      where: {
        communityId,
        status: 'PUBLISHED',
        deletedAt: null,
        ...(blockedIds.length > 0 ? { userId: { notIn: blockedIds } } : {}),
        ...(decoded ? { createdAt: { lt: new Date(decoded.createdAt) } } : {}),
      },
      take: limit + 1,
      orderBy: { createdAt: 'desc' },
      include: {
        anonymousIdentity: true,
        community: true,
        _count: { select: { comments: true, reactions: true } },
      },
    });

    const mapped = posts.map((p) => ({
      id: p.id,
      anonymous_name: p.anonymousIdentity?.displayCode ?? 'Anonymous',
      category: p.category,
      content: p.content,
      status: p.status,
      community_id: p.communityId,
      community_name: p.community?.name ?? null,
      comments_enabled: p.commentsEnabled,
      comment_count: (p as any)._count?.comments ?? 0,
      reaction_count: (p as any)._count?.reactions ?? 0,
      created_at: p.createdAt,
    }));

    return buildPaginatedResponse(mapped, limit, (item) => ({
      id: item.id,
      createdAt: new Date(item.created_at).toISOString(),
    }));
  }

  private async isCommunityStaff(communityId: string, userId: string): Promise<boolean> {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (community?.ownerId === userId) return true;

    const role = await this.prisma.communityRole.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    return role?.role === 'OWNER' || role?.role === 'MODERATOR';
  }
}
