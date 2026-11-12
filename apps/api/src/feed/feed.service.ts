import { Injectable } from '@nestjs/common';
import { PostCategory } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { BlocksService } from '../blocks/blocks.service';
import { buildPaginatedResponse, decodeCursor } from '../common/utils/pagination.util';

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
  ) {}

  async getNearby(q: FeedQuery) {
    let communityIds: string[] | undefined;
    if (q.city && !q.communityId) {
      const cityCommunities = await this.prisma.community.findMany({
        where: { city: { contains: q.city, mode: 'insensitive' }, status: 'ACTIVE' },
        select: { id: true },
      });
      communityIds = cityCommunities.map((c) => c.id);
      if (communityIds.length === 0) {
        return { data: [], next_cursor: null, has_more: false };
      }
    }

    return this.queryFeed({ ...q, communityIds });
  }

  async getLatest(q: FeedQuery) {
    return this.queryFeed(q);
  }

  async getTrending(q: FeedQuery) {
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

  async getByCategory(q: FeedQuery & { category: PostCategory }) {
    return this.queryFeed(q);
  }

  private async queryFeed(q: FeedQuery & { communityIds?: string[] }) {
    const limit = Math.min(Math.max(q.limit ?? 20, 1), 50);
    const decoded = decodeCursor(q.cursor);
    const blockedIds = await this.blocksService.getBlockedUserIds(q.userId);

    const where: Record<string, any> = {
      status: 'PUBLISHED',
      deletedAt: null,
      ...(q.communityId ? { communityId: q.communityId } : {}),
      ...(q.communityIds ? { communityId: { in: q.communityIds } } : {}),
      ...(q.category ? { category: q.category } : {}),
      ...(blockedIds.length > 0 ? { userId: { notIn: blockedIds } } : {}),
      ...(decoded ? { createdAt: { lt: new Date(decoded.createdAt) } } : {}),
    };

    const posts = await this.prisma.post.findMany({
      where,
      take: limit + 1,
      orderBy: { createdAt: 'desc' },
      include: {
        anonymousIdentity: true,
        community: true,
        _count: { select: { comments: true, reactions: true } },
      },
    });

    const mapped = posts.map((p) => this.mapPost(p));
    return buildPaginatedResponse(mapped, limit, (item) => ({
      id: item.id,
      createdAt: new Date(item.created_at).toISOString(),
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
      created_at: p.createdAt,
    };
  }
}
