import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { PostCategory } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { BlocksService } from '../blocks/blocks.service';
import { buildPaginatedResponse, decodeCursor } from '../common/utils/pagination.util';
import { TrendingService } from './trending.service';

export interface FeedQuery {
  userId: string;
  communityId?: string;
  city?: string;
  category?: PostCategory;
  cursor?: string;
  limit?: number;
}

@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocksService: BlocksService,
    @Optional() private readonly trendingService?: TrendingService,
  ) {}

  async getNearby(q: FeedQuery) {
    let communityIds: string[] | undefined;
    let targetCity = q.city;

    // If city is not provided, check user's ephemeral GPS or location preference
    if (!targetCity && !q.communityId && q.userId) {
      const now = new Date();
      const temporaryGps = await this.prisma.temporaryUserGps.findUnique({
        where: { userId: q.userId },
      });

      if (temporaryGps && temporaryGps.expiresAt > now && temporaryGps.geoCell) {
        const cellCommunities = await this.prisma.community.findMany({
          where: { geoCell: temporaryGps.geoCell, status: 'ACTIVE' },
          select: { id: true },
        });
        if (cellCommunities.length > 0) {
          communityIds = cellCommunities.map((c) => c.id);
        }
      }

      if (!communityIds) {
        const pref = await this.prisma.locationPreference.findUnique({
          where: { userId: q.userId },
        });
        if (pref && pref.selectedCity) {
          targetCity = pref.selectedCity;
        }
      }
    }

    if (targetCity && !q.communityId) {
      const cityCommunities = await this.prisma.community.findMany({
        where: {
          city: { contains: targetCity, mode: 'insensitive' },
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      communityIds = cityCommunities.map((c) => c.id);
      if (communityIds.length === 0) {
        return { data: [], next_cursor: null, has_more: false };
      }
    }

    return this.queryFeed({ ...q, communityIds });
  }

  async getCityFeed(citySlug: string, q: FeedQuery) {
    const cityCommunities = await this.prisma.community.findMany({
      where: {
        OR: [
          { slug: { contains: citySlug, mode: 'insensitive' } },
          { city: { contains: citySlug, mode: 'insensitive' } },
        ],
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    const communityIds = cityCommunities.map((c) => c.id);
    if (communityIds.length === 0) {
      return { data: [], next_cursor: null, has_more: false };
    }

    return this.queryFeed({ ...q, communityIds });
  }

  async getPublicFeed(q: FeedQuery) {
    return this.queryFeed(q);
  }

  async getPersonalizedFeed(userId: string, q: FeedQuery) {
    const memberships = await this.prisma.communityMember.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { communityId: true },
    });

    const joinedCommunityIds = memberships.map((m) => m.communityId);

    // Also include user's preferred city communities if set
    const pref = await this.prisma.locationPreference.findUnique({
      where: { userId },
    });

    let cityCommunityIds: string[] = [];
    if (pref?.selectedCity) {
      const cityCommunities = await this.prisma.community.findMany({
        where: {
          city: { contains: pref.selectedCity, mode: 'insensitive' },
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      cityCommunityIds = cityCommunities.map((c) => c.id);
    }

    const combinedCommunityIds = Array.from(
      new Set([...joinedCommunityIds, ...cityCommunityIds]),
    );

    if (combinedCommunityIds.length === 0) {
      // Fall back to general public feed
      return this.queryFeed(q);
    }

    return this.queryFeed({ ...q, communityIds: combinedCommunityIds });
  }

  async getLatest(q: FeedQuery) {
    return this.queryFeed(q);
  }

  async getTrending(q: FeedQuery) {
    if (this.trendingService) {
      return this.trendingService.getTrendingPosts({
        userId: q.userId,
        citySlug: q.city,
        communityId: q.communityId,
        limit: q.limit,
        cursor: q.cursor,
      });
    }

    // Default inline fallback if TrendingService not provided
    const limit = Math.min(Math.max(q.limit ?? 20, 1), 50);
    const blockedIds = await this.blocksService.getBlockedUserIds(q.userId);
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const posts = await this.prisma.post.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        createdAt: { gte: since },
        ...(q.communityId ? { communityId: q.communityId } : {}),
        ...(q.category ? { category: q.category } : {}),
        ...(blockedIds.length > 0 ? { userId: { notIn: blockedIds } } : {}),
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        anonymousIdentity: true,
        community: true,
        poll: { include: { options: true } },
        _count: { select: { comments: true, reactions: true } },
      },
    });

    const nowMs = Date.now();
    const scored = posts
      .map((p) => {
        const comments = (p as any)._count?.comments ?? 0;
        const reactions = (p as any)._count?.reactions ?? 0;
        const ageHours = Math.max(0.5, (nowMs - new Date(p.createdAt).getTime()) / 3600000);
        const score = (reactions * 2 + comments * 3 + 1) / Math.pow(ageHours + 2, 1.2);
        return { post: p, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => this.mapPost(item.post));

    return { data: scored, next_cursor: null, has_more: false };
  }

  async getByCategory(
    categoryOrQuery: string | (FeedQuery & { category?: PostCategory | string }),
    userId?: string,
    query?: { limit?: number; cursor?: string; community_id?: string },
  ) {
    let category: string;
    let effectiveUserId: string;
    let limit = 20;
    let cursor: string | undefined;
    let communityId: string | undefined;

    if (typeof categoryOrQuery === 'string') {
      category = categoryOrQuery;
      effectiveUserId = userId!;
      limit = query?.limit ? Number(query.limit) : 20;
      cursor = query?.cursor;
      communityId = query?.community_id;
    } else {
      category = (categoryOrQuery.category as string) ?? '';
      effectiveUserId = categoryOrQuery.userId;
      limit = categoryOrQuery.limit ? Number(categoryOrQuery.limit) : 20;
      cursor = categoryOrQuery.cursor;
      communityId = categoryOrQuery.communityId;
    }

    const validCategories = [
      'CONFESSION',
      'STORY',
      'QUESTION',
      'GOSSIP',
      'RANT',
      'CAMPUS',
      'NEIGHBORHOOD',
      'LOCAL_ALERT',
      'POLL',
    ];
    const upperCategory = (category ?? '').toUpperCase();
    if (!validCategories.includes(upperCategory)) {
      throw new BadRequestException({
        error: 'INVALID_CATEGORY',
        message: `Category must be one of: ${validCategories.join(', ')}`,
      });
    }

    return this.queryFeed({
      userId: effectiveUserId,
      category: upperCategory as PostCategory,
      communityId,
      cursor,
      limit,
    });
  }

  async getByHashtag(
    hashtag: string,
    userId: string,
    query?: { limit?: number; cursor?: string },
  ) {
    const rawTag = hashtag.replace(/^#/, '').toLowerCase().trim();
    const tagRecord = await this.prisma.hashtag.findUnique({
      where: { tag: rawTag },
    });
    if (!tagRecord) {
      return { data: [], next_cursor: null, has_more: false };
    }

    const postHashtags = await this.prisma.postHashtag.findMany({
      where: { hashtagId: tagRecord.id },
      select: { postId: true },
    });
    const postIds = postHashtags.map((ph: any) => ph.postId);
    if (postIds.length === 0) {
      return { data: [], next_cursor: null, has_more: false };
    }

    return this.queryFeed({
      userId,
      limit: query?.limit ? Number(query.limit) : 20,
      cursor: query?.cursor,
      postIds,
    });
  }

  private async queryFeed(q: FeedQuery & { communityIds?: string[]; postIds?: string[] }) {
    const limit = Math.min(Math.max(q.limit ?? 20, 1), 50);
    const cursor = decodeCursor(q.cursor);
    const blockedIds = await this.blocksService.getBlockedUserIds(q.userId);

    const where: Record<string, any> = {
      status: 'PUBLISHED',
      deletedAt: null,
      isDraft: false,
      ...(q.postIds ? { id: { in: q.postIds } } : {}),
      ...(q.communityId ? { communityId: q.communityId } : {}),
      ...(q.communityIds ? { communityId: { in: q.communityIds } } : {}),
      ...(q.category ? { category: q.category } : {}),
      ...(blockedIds.length > 0 ? { userId: { notIn: blockedIds } } : {}),
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : {}),
    };

    const posts = await this.prisma.post.findMany({
      where,
      take: limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        anonymousIdentity: true,
        community: true,
        poll: { include: { options: true } },
        _count: { select: { comments: true, reactions: true } },
      },
    });

    const mapped = posts.map((p) => this.mapPost(p));
    return buildPaginatedResponse(mapped, limit, (item) => ({
      id: item.id,
      createdAt: item.created_at,
    }));
  }

  private mapPost(p: any) {
    return {
      id: p.id,
      anonymous_name: p.anonymousIdentity?.displayCode ?? 'Anonymous',
      category: p.category,
      content: p.content,
      status: p.status,
      community_id: p.communityId,
      community_name: p.community?.name ?? null,
      city: p.community?.city ?? null,
      comments_enabled: p.commentsEnabled,
      comment_count: p._count?.comments ?? 0,
      reaction_count: p._count?.reactions ?? 0,
      poll: p.poll ?? null,
      created_at: p.createdAt,
    };
  }
}
