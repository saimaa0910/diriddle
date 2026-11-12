import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CommunityType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { BlocksService } from '../blocks/blocks.service';
import { buildPaginatedResponse, decodeCursor } from '../common/utils/pagination.util';

@Injectable()
export class CommunitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocksService: BlocksService,
  ) {}

  async findAll(
    userId: string,
    query: { city?: string; state?: string; type?: string; q?: string; cursor?: string; limit?: number },
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

    const membership = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId, communityId: id } },
    });

    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      type: c.type,
      city: c.city,
      state: c.state,
      status: c.status,
      member_count: (c as any)._count?.members ?? 0,
      post_count: (c as any)._count?.posts ?? 0,
      is_member: membership?.status === 'ACTIVE',
      created_at: c.createdAt,
    };
  }

  async join(communityId: string, userId: string) {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community || community.status !== 'ACTIVE') {
      throw new NotFoundException({
        error: 'COMMUNITY_NOT_FOUND',
        message: 'Community not found or inactive',
      });
    }

    const existing = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });
    if (existing?.status === 'BANNED') {
      throw new ForbiddenException({
        error: 'COMMUNITY_BANNED',
        message: 'You are banned from this community',
      });
    }

    await this.prisma.communityMember.upsert({
      where: { userId_communityId: { userId, communityId } },
      create: { userId, communityId, status: 'ACTIVE' },
      update: { status: 'ACTIVE' },
    });

    return { status: 'joined', community_id: communityId };
  }

  async leave(communityId: string, userId: string) {
    await this.prisma.communityMember.updateMany({
      where: { userId, communityId },
      data: { status: 'LEFT' },
    });
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
}
