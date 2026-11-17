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

  async reactToComment(commentId: string, reactionType: ReactionType, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { post: true },
    });
    if (!comment || comment.deletedAt || comment.status === 'REMOVED') {
      throw new NotFoundException({
        error: 'COMMENT_NOT_FOUND',
        message: 'Comment not found',
      });
    }

    const existing = await this.prisma.commentReaction.findUnique({
      where: { commentId_userId: { commentId, userId } },
    });

    let activeReaction: ReactionType | null = reactionType;
    if (existing && existing.reactionType === reactionType) {
      await this.prisma.commentReaction.delete({ where: { id: existing.id } });
      activeReaction = null;
    } else {
      await this.prisma.commentReaction.upsert({
        where: { commentId_userId: { commentId, userId } },
        create: { commentId, userId, reactionType },
        update: { reactionType },
      });

      if (comment.userId !== userId && !existing) {
        await this.notifications.notify(comment.userId, 'REACTION', comment.postId, {
          comment_id: comment.id,
          post_id: comment.postId,
          reaction_type: reactionType,
        });
      }
    }

    const reactionCounts = await this.getCommentCounts(commentId);
    return {
      comment_id: commentId,
      reaction_counts: reactionCounts,
      total_reactions: Object.values(reactionCounts).reduce((a, b) => a + b, 0),
      user_reaction: activeReaction,
    };
  }

  async unreactComment(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.deletedAt) {
      throw new NotFoundException({
        error: 'COMMENT_NOT_FOUND',
        message: 'Comment not found',
      });
    }

    await this.prisma.commentReaction.deleteMany({ where: { commentId, userId } });
    const reactionCounts = await this.getCommentCounts(commentId);
    return {
      comment_id: commentId,
      reaction_counts: reactionCounts,
      total_reactions: Object.values(reactionCounts).reduce((a, b) => a + b, 0),
      user_reaction: null,
    };
  }

  async getCommentCounts(commentId: string): Promise<Record<string, number>> {
    const counts = await this.prisma.commentReaction.groupBy({
      by: ['reactionType'],
      where: { commentId },
      _count: true,
    });
    return Object.fromEntries(counts.map((c) => [c.reactionType, Number(c._count)]));
  }
}
