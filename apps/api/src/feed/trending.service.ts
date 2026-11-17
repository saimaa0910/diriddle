import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { BlocksService } from '../blocks/blocks.service';

export interface TrendingQuery {
  userId: string;
  citySlug?: string;
  communityId?: string;
  limit?: number;
  cursor?: string;
}

@Injectable()
export class TrendingService {
  private readonly logger = new Logger(TrendingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blocksService: BlocksService,
  ) {}

  /**
   * Calculate trending score using time-decay formula:
   * (reactions * 2 + comments * 3 + 1) / ((ageInHours + 2) ^ 1.2)
   */
  calculateScore(reactionCount: number, commentCount: number, createdAt: Date, now: Date = new Date()): number {
    const ageHours = Math.max(0.1, (now.getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60));
    const numerator = reactionCount * 2 + commentCount * 3 + 1;
    const denominator = Math.pow(ageHours + 2, 1.2);
    return Number((numerator / denominator).toFixed(4));
  }

  /**
   * Recalculates and persists trending scores for all active published posts
   * in the last 48 hours for a given city (or globally).
   */
  async refreshTrendingScores(citySlug?: string): Promise<{ processed: number; updated: number }> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    let communityFilter: any = {};
    if (citySlug) {
      const communities = await this.prisma.community.findMany({
        where: {
          city: { contains: citySlug, mode: 'insensitive' },
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      const commIds = communities.map((c) => c.id);
      if (commIds.length === 0) {
        return { processed: 0, updated: 0 };
      }
      communityFilter = { communityId: { in: commIds } };
    }

    const posts = await this.prisma.post.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        isDraft: false,
        createdAt: { gte: windowStart },
        ...communityFilter,
      },
      include: {
        community: true,
        _count: {
          select: {
            reactions: true,
            comments: true,
          },
        },
      },
      take: 500,
    });

    let updatedCount = 0;

    for (const post of posts) {
      const reactions = (post as any)._count?.reactions ?? 0;
      const comments = (post as any)._count?.comments ?? 0;
      const score = this.calculateScore(reactions, comments, post.createdAt, now);
      const postCitySlug = post.community?.city?.toLowerCase() ?? citySlug?.toLowerCase() ?? 'general';

      await this.prisma.trendingScore.upsert({
        where: { postId: post.id },
        create: {
          postId: post.id,
          citySlug: postCitySlug,
          communityId: post.communityId,
          score,
          windowStart,
          windowEnd: now,
        },
        update: {
          score,
          citySlug: postCitySlug,
          communityId: post.communityId,
          windowEnd: now,
        },
      });

      updatedCount++;
    }

    this.logger.log(`Refreshed trending scores: ${updatedCount} posts scored.`);
    return { processed: posts.length, updated: updatedCount };
  }

  /**
   * Retrieves trending posts utilizing the persisted TrendingScore records
   * falling back to dynamic score calculation if empty.
   */
  async getTrendingPosts(q: TrendingQuery) {
    const limit = Math.min(Math.max(q.limit ?? 20, 1), 50);
    const blockedIds = await this.blocksService.getBlockedUserIds(q.userId);

    const trendingRecords = await this.prisma.trendingScore.findMany({
      where: {
        ...(q.citySlug ? { citySlug: { contains: q.citySlug, mode: 'insensitive' } } : {}),
        ...(q.communityId ? { communityId: q.communityId } : {}),
      },
      orderBy: { score: 'desc' },
      take: limit * 2,
    });

    if (trendingRecords.length > 0) {
      const postIds = trendingRecords.map((t) => t.postId);
      const scoreMap = new Map<string, number>(trendingRecords.map((t) => [t.postId, t.score]));

      const posts = await this.prisma.post.findMany({
        where: {
          id: { in: postIds },
          status: 'PUBLISHED',
          deletedAt: null,
          isDraft: false,
          ...(blockedIds.length > 0 ? { userId: { notIn: blockedIds } } : {}),
        },
        include: {
          anonymousIdentity: true,
          community: true,
          poll: { include: { options: true } },
          _count: { select: { comments: true, reactions: true } },
        },
      });

      const sorted = posts
        .map((p) => ({ post: p, score: scoreMap.get(p.id) ?? 0 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return {
        data: sorted.map((s) => this.mapTrendingPost(s.post, s.score)),
        has_more: false,
        next_cursor: null,
      };
    }

    // Dynamic fallback when scores haven't been generated yet
    const windowStart = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const fallbackPosts = await this.prisma.post.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        isDraft: false,
        createdAt: { gte: windowStart },
        ...(q.communityId ? { communityId: q.communityId } : {}),
        ...(blockedIds.length > 0 ? { userId: { notIn: blockedIds } } : {}),
      },
      include: {
        anonymousIdentity: true,
        community: true,
        poll: { include: { options: true } },
        _count: { select: { comments: true, reactions: true } },
      },
      take: 100,
    });

    const scored = fallbackPosts
      .map((p) => {
        const reactions = (p as any)._count?.reactions ?? 0;
        const comments = (p as any)._count?.comments ?? 0;
        const score = this.calculateScore(reactions, comments, p.createdAt);
        return { post: p, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      data: scored.map((s) => this.mapTrendingPost(s.post, s.score)),
      has_more: false,
      next_cursor: null,
    };
  }

  private mapTrendingPost(p: any, score: number) {
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
      trending_score: score,
      poll: p.poll ?? null,
      created_at: p.createdAt,
    };
  }
}
