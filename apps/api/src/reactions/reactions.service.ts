import { Injectable, NotFoundException } from '@nestjs/common';
import { ReactionType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CommunityGateway } from '../realtime/community.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: CommunityGateway,
    private readonly notifications: NotificationsService,
  ) {}

  async react(postId: string, reactionType: ReactionType, userId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) {
      throw new NotFoundException({
        error: 'POST_NOT_FOUND',
        message: 'Post not found',
      });
    }

    const existing = await this.prisma.reaction.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    let activeReaction: ReactionType | null = reactionType;
    if (existing && existing.reactionType === reactionType) {
      await this.prisma.reaction.delete({ where: { id: existing.id } });
      activeReaction = null;
    } else {
      await this.prisma.reaction.upsert({
        where: { postId_userId: { postId, userId } },
        create: { postId, userId, reactionType },
        update: { reactionType },
      });

      if (post.userId !== userId && !existing) {
        await this.notifications.notify(post.userId, 'REACTION', post.id, {
          post_id: post.id,
          reaction_type: reactionType,
        });
      }
    }

    const reactionCounts = await this.getCounts(postId);
    const payload = {
      post_id: postId,
      reaction_counts: reactionCounts,
      total_reactions: Object.values(reactionCounts).reduce((a, b) => a + b, 0),
    };
    this.gateway.broadcastReactionUpdated(post.communityId, payload);

    return {
      ...payload,
      user_reaction: activeReaction,
    };
  }

  async unreact(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) {
      throw new NotFoundException({
        error: 'POST_NOT_FOUND',
        message: 'Post not found',
      });
    }

    await this.prisma.reaction.deleteMany({ where: { postId, userId } });
    const reactionCounts = await this.getCounts(postId);
    const payload = {
      post_id: postId,
      reaction_counts: reactionCounts,
      total_reactions: Object.values(reactionCounts).reduce((a, b) => a + b, 0),
    };
    this.gateway.broadcastReactionUpdated(post.communityId, payload);

    return {
      ...payload,
      user_reaction: null,
    };
  }

  async getCounts(postId: string): Promise<Record<string, number>> {
    const counts = await this.prisma.reaction.groupBy({
      by: ['reactionType'],
      where: { postId },
      _count: true,
    });
    return Object.fromEntries(counts.map((c) => [c.reactionType, Number(c._count)]));
  }
}
