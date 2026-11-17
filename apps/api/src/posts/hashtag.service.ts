import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class HashtagService {
  constructor(private readonly prisma: PrismaService) {}

  extractHashtags(content: string): string[] {
    if (!content) return [];
    // Match hashtags including Unicode letters (e.g. Hindi/Devanagari, regional scripts)
    const matches = content.match(/#([\p{L}\p{N}_]{1,50})/gu);
    if (!matches) return [];

    const uniqueTags = new Set<string>();
    for (const match of matches) {
      const tag = match.substring(1).toLowerCase();
      if (tag.length > 0) {
        uniqueTags.add(tag);
      }
    }

    return Array.from(uniqueTags).slice(0, 10); // max 10 hashtags per post
  }

  async upsertPostHashtags(postId: string, tags: string[]): Promise<void> {
    if (tags.length === 0) return;

    for (const tag of tags) {
      const hashtag = await this.prisma.hashtag.upsert({
        where: { tag },
        create: { tag, postCount: 1 },
        update: { postCount: { increment: 1 } },
      });

      await this.prisma.postHashtag.upsert({
        where: { postId_hashtagId: { postId, hashtagId: hashtag.id } },
        create: { postId, hashtagId: hashtag.id },
        update: {},
      });
    }
  }

  async removePostHashtags(postId: string): Promise<void> {
    const postHashtags = await this.prisma.postHashtag.findMany({
      where: { postId },
    });

    for (const ph of postHashtags) {
      await this.prisma.hashtag.update({
        where: { id: ph.hashtagId },
        data: { postCount: { decrement: 1 } },
      });
    }

    await this.prisma.postHashtag.deleteMany({ where: { postId } });
  }

  async searchHashtags(query: string, limit = 20) {
    const trimmed = query.trim().toLowerCase().replace(/^#/, '');
    const limitNum = Math.min(Math.max(limit, 1), 50);

    const hashtags = await this.prisma.hashtag.findMany({
      where: trimmed ? { tag: { contains: trimmed, mode: 'insensitive' } } : {},
      orderBy: { postCount: 'desc' },
      take: limitNum,
    });

    return {
      data: hashtags.map((h) => ({
        id: h.id,
        tag: `#${h.tag}`,
        raw_tag: h.tag,
        post_count: Math.max(h.postCount, 0),
      })),
    };
  }

  async getTrendingHashtags(limit = 10) {
    const hashtags = await this.prisma.hashtag.findMany({
      where: { postCount: { gt: 0 } },
      orderBy: { postCount: 'desc' },
      take: Math.min(Math.max(limit, 1), 50),
    });

    return {
      data: hashtags.map((h) => ({
        id: h.id,
        tag: `#${h.tag}`,
        raw_tag: h.tag,
        post_count: h.postCount,
      })),
    };
  }
}
