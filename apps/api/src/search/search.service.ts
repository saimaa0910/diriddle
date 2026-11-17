import { Injectable } from '@nestjs/common';
import { SearchType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { BlocksService } from '../blocks/blocks.service';

export interface SearchPostsOptions {
  query: string;
  userId: string;
  communityId?: string;
  city?: string;
  limit?: number;
  cursor?: string;
}

export interface SearchCommunitiesOptions {
  query: string;
  city?: string;
  type?: string;
  limit?: number;
}

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocksService: BlocksService,
  ) {}

  async searchPosts(opts: SearchPostsOptions) {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
    const blockedIds = await this.blocksService.getBlockedUserIds(opts.userId);

    let communityFilter: any = {};
    if (opts.communityId) {
      communityFilter = { communityId: opts.communityId };
    } else if (opts.city) {
      const cityCommunities = await this.prisma.community.findMany({
        where: {
          city: { contains: opts.city, mode: 'insensitive' },
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      const cids = cityCommunities.map((c) => c.id);
      communityFilter = { communityId: { in: cids } };
    }

    const posts = await this.prisma.post.findMany({
      where: {
        content: { contains: opts.query, mode: 'insensitive' },
        status: 'PUBLISHED',
        deletedAt: null,
        isDraft: false,
        ...(blockedIds.length > 0 ? { userId: { notIn: blockedIds } } : {}),
        ...communityFilter,
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        anonymousIdentity: true,
        community: true,
        _count: { select: { comments: true, reactions: true } },
      },
    });

    // Auto-record search history if query is meaningful
    if (opts.query && opts.query.trim().length >= 2) {
      await this.recordSearchHistory(opts.userId, opts.query.trim(), SearchType.POST);
    }

    return {
      data: posts.map((p) => ({
        id: p.id,
        anonymous_name: p.anonymousIdentity?.displayCode ?? 'Anonymous',
        category: p.category,
        content: p.content,
        status: p.status,
        community_id: p.communityId,
        community_name: p.community?.name ?? null,
        city: p.community?.city ?? null,
        comments_enabled: p.commentsEnabled,
        comment_count: (p as any)._count?.comments ?? 0,
        reaction_count: (p as any)._count?.reactions ?? 0,
        created_at: p.createdAt,
      })),
      total: posts.length,
    };
  }

  async searchCommunities(opts: SearchCommunitiesOptions, userId?: string) {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);

    const communities = await this.prisma.community.findMany({
      where: {
        OR: [
          { name: { contains: opts.query, mode: 'insensitive' } },
          { description: { contains: opts.query, mode: 'insensitive' } },
          { slug: { contains: opts.query, mode: 'insensitive' } },
          { city: { contains: opts.query, mode: 'insensitive' } },
        ],
        status: 'ACTIVE',
        ...(opts.city ? { city: { contains: opts.city, mode: 'insensitive' } } : {}),
        ...(opts.type ? { type: opts.type as any } : {}),
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { members: true, posts: true } },
      },
    });

    if (userId && opts.query && opts.query.trim().length >= 2) {
      await this.recordSearchHistory(userId, opts.query.trim(), SearchType.COMMUNITY);
    }

    return {
      data: communities.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        type: c.type,
        city: c.city,
        state: c.state,
        description: c.description,
        member_count: (c as any)._count?.members ?? 0,
        post_count: (c as any)._count?.posts ?? 0,
        created_at: c.createdAt,
      })),
      total: communities.length,
    };
  }

  async searchHashtags(query: string, userId?: string, limit = 20) {
    const normalized = query.replace(/^#/, '').toLowerCase().trim();
    const take = Math.min(Math.max(limit, 1), 50);

    const tags = await this.prisma.hashtag.findMany({
      where: {
        tag: { contains: normalized, mode: 'insensitive' },
      },
      take,
      orderBy: { postCount: 'desc' },
    });

    if (userId && normalized.length >= 2) {
      await this.recordSearchHistory(userId, `#${normalized}`, SearchType.HASHTAG);
    }

    return {
      data: tags.map((t) => ({
        id: t.id,
        tag: `#${t.tag}`,
        raw_tag: t.tag,
        post_count: t.postCount,
        created_at: t.createdAt,
      })),
      total: tags.length,
    };
  }

  async searchCities(query: string, limit = 20) {
    const trimmed = query.trim();
    const take = Math.min(Math.max(limit, 1), 50);

    const cities = await this.prisma.city.findMany({
      where: {
        OR: [
          { name: { contains: trimmed, mode: 'insensitive' } },
          { slug: { contains: trimmed, mode: 'insensitive' } },
        ],
        isActive: true,
      },
      take,
      orderBy: { name: 'asc' },
      include: { state: true },
    });

    return {
      data: cities.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        state_name: c.state?.name ?? null,
        center_lat: c.centerLat,
        center_lng: c.centerLng,
        radius_km: c.radiusKm,
        is_active: c.isActive,
      })),
      total: cities.length,
    };
  }

  async recordSearchHistory(userId: string, query: string, searchType: SearchType) {
    try {
      await this.prisma.searchHistory.create({
        data: {
          userId,
          query,
          searchType,
        },
      });
    } catch {
      // Non-fatal if recording history fails
    }
  }

  async getSearchHistory(userId: string, limit = 20) {
    const take = Math.min(Math.max(limit, 1), 50);
    const history = await this.prisma.searchHistory.findMany({
      where: { userId },
      take,
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: history.map((h) => ({
        id: h.id,
        query: h.query,
        search_type: h.searchType,
        created_at: h.createdAt,
      })),
    };
  }

  async clearSearchHistory(userId: string, historyId?: string) {
    if (historyId) {
      await this.prisma.searchHistory.deleteMany({
        where: { id: historyId, userId },
      });
      return { success: true, message: 'Search history entry deleted' };
    }

    await this.prisma.searchHistory.deleteMany({
      where: { userId },
    });
    return { success: true, message: 'All search history cleared' };
  }

  async searchGlobal(opts: { query: string; userId: string; limit?: number }) {
    const q = opts.query ?? '';
    const limit = Math.min(Math.max(opts.limit ?? 10, 1), 20);

    const [posts, communities, hashtags, cities] = await Promise.all([
      this.searchPosts({ query: q, userId: opts.userId, limit }),
      this.searchCommunities({ query: q, limit }, opts.userId),
      this.searchHashtags(q, opts.userId, limit),
      this.searchCities(q, limit),
    ]);

    return {
      query: q,
      posts: posts.data,
      communities: communities.data,
      hashtags: hashtags.data,
      cities: cities.data,
    };
  }

  async getSuggestions(query: string, limit = 10) {
    const trimmed = query.trim().toLowerCase().replace(/^#/, '');
    if (!trimmed) {
      return { suggestions: [] };
    }
    const take = Math.min(Math.max(limit, 1), 20);

    const [hashtags, communities, cities] = await Promise.all([
      this.prisma.hashtag.findMany({
        where: { tag: { contains: trimmed, mode: 'insensitive' } },
        take: 5,
        orderBy: { postCount: 'desc' },
      }),
      this.prisma.community.findMany({
        where: {
          name: { contains: trimmed, mode: 'insensitive' },
          status: 'ACTIVE',
        },
        take: 5,
      }),
      this.prisma.city.findMany({
        where: {
          name: { contains: trimmed, mode: 'insensitive' },
          isActive: true,
        },
        take: 5,
      }),
    ]);

    const suggestions = [
      ...hashtags.map((h) => ({ type: 'HASHTAG', text: `#${h.tag}`, id: h.id })),
      ...communities.map((c) => ({ type: 'COMMUNITY', text: c.name, id: c.id, slug: c.slug })),
      ...cities.map((ci) => ({ type: 'CITY', text: ci.name, id: ci.id, slug: ci.slug })),
    ].slice(0, take);

    return { suggestions };
  }

  async getTrendingHashtags(limit = 10) {
    const take = Math.min(Math.max(limit, 1), 50);
    const tags = await this.prisma.hashtag.findMany({
      where: { postCount: { gt: 0 } },
      orderBy: { postCount: 'desc' },
      take,
    });

    return {
      data: tags.map((t) => ({
        id: t.id,
        tag: `#${t.tag}`,
        raw_tag: t.tag,
        post_count: t.postCount,
      })),
      total: tags.length,
    };
  }
}
