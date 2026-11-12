import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { IdentitiesService } from '../identities/identities.service';
import { ModerationService } from '../moderation/moderation.service';
import { BlocksService } from '../blocks/blocks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CommunityGateway } from '../realtime/community.gateway';
import { buildPaginatedResponse, decodeCursor } from '../common/utils/pagination.util';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identitiesService: IdentitiesService,
    private readonly moderationService: ModerationService,
    private readonly blocksService: BlocksService,
    private readonly notifications: NotificationsService,
    private readonly gateway: CommunityGateway,
  ) {}

  async getComments(
    postId: string,
    userId: string,
    pagination: { cursor?: string; limit?: number },
  ) {
    const limit = Math.min(Math.max(pagination.limit ?? 20, 1), 50);
    const decoded = decodeCursor(pagination.cursor);
    const blockedIds = await this.blocksService.getBlockedUserIds(userId);

    const comments = await this.prisma.comment.findMany({
      where: {
        postId,
        parentCommentId: null,
        status: 'ACTIVE',
        deletedAt: null,
        ...(blockedIds.length > 0 ? { userId: { notIn: blockedIds } } : {}),
        ...(decoded ? { createdAt: { gt: new Date(decoded.createdAt) } } : {}),
      },
      take: limit + 1,
      orderBy: { createdAt: 'asc' },
      include: {
        anonymousIdentity: true,
        replies: {
          where: {
            status: 'ACTIVE',
            deletedAt: null,
            ...(blockedIds.length > 0 ? { userId: { notIn: blockedIds } } : {}),
          },
          include: { anonymousIdentity: true },
        },
      },
    });

    const mapped = comments.map((c) => ({
      id: c.id,
      post_id: c.postId,
      anonymous_name: c.anonymousIdentity?.displayCode ?? 'Anonymous',
      content: c.content,
      is_own: c.userId === userId,
      created_at: c.createdAt,
      replies: ((c as any).replies ?? []).map((r: any) => ({
        id: r.id,
        post_id: r.postId,
        parent_comment_id: r.parentCommentId,
        anonymous_name: r.anonymousIdentity?.displayCode ?? 'Anonymous',
        content: r.content,
        is_own: r.userId === userId,
        created_at: r.createdAt,
      })),
    }));

    return buildPaginatedResponse(mapped, limit, (item) => ({
      id: item.id,
      createdAt: new Date(item.created_at).toISOString(),
    }));
  }

  async createComment(postId: string, content: string, userId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt || post.status === 'REMOVED') {
      throw new NotFoundException({
        error: 'POST_NOT_FOUND',
        message: 'Post not found',
      });
    }
    if (!post.commentsEnabled) {
      throw new ForbiddenException({
        error: 'COMMENTS_DISABLED',
        message: 'Comments are disabled for this post',
      });
    }

    const safety = this.moderationService.checkContentSafety(content);
    if (!safety.allowed || safety.action === 'REJECT') {
      throw new BadRequestException({
        error: 'CONTENT_PII_REJECTED',
        message: 'Comment contains restricted personal information',
      });
    }

    const identity = await this.identitiesService.getOrCreateForCommunity(
      userId,
      post.communityId,
    );

    const status = safety.action === 'HOLD_FOR_REVIEW' ? 'FLAGGED' : 'ACTIVE';
    const comment = await this.prisma.comment.create({
      data: {
        postId,
        userId,
        anonymousIdentityId: identity.id,
        content,
        status,
      },
      include: { anonymousIdentity: true },
    });

    const dto = {
      id: comment.id,
      post_id: comment.postId,
      anonymous_name: comment.anonymousIdentity?.displayCode ?? identity.displayCode,
      content: comment.content,
      status: comment.status,
      created_at: comment.createdAt,
    };

    if (status === 'ACTIVE') {
      this.gateway.broadcastCommentCreated(post.communityId, dto);
      if (post.userId !== userId) {
        await this.notifications.notify(post.userId, 'COMMENT_REPLY', post.id, {
          post_id: post.id,
          comment_id: comment.id,
          anonymous_name: dto.anonymous_name,
        });
      }
    }

    return dto;
  }

  async createReply(commentId: string, content: string, userId: string) {
    const parent = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { post: true },
    });
    if (!parent || parent.deletedAt || !parent.post || parent.post.deletedAt) {
      throw new NotFoundException({
        error: 'COMMENT_NOT_FOUND',
        message: 'Parent comment not found',
      });
    }
    if (!parent.post.commentsEnabled) {
      throw new ForbiddenException({
        error: 'COMMENTS_DISABLED',
        message: 'Comments are disabled for this post',
      });
    }

    const safety = this.moderationService.checkContentSafety(content);
    if (!safety.allowed || safety.action === 'REJECT') {
      throw new BadRequestException({
        error: 'CONTENT_PII_REJECTED',
        message: 'Reply contains restricted personal information',
      });
    }

    const identity = await this.identitiesService.getOrCreateForCommunity(
      userId,
      parent.post.communityId,
    );

    const status = safety.action === 'HOLD_FOR_REVIEW' ? 'FLAGGED' : 'ACTIVE';
    const reply = await this.prisma.comment.create({
      data: {
        postId: parent.postId,
        userId,
        anonymousIdentityId: identity.id,
        parentCommentId: commentId,
        content,
        status,
      },
      include: { anonymousIdentity: true },
    });

    const dto = {
      id: reply.id,
      post_id: reply.postId,
      parent_comment_id: reply.parentCommentId,
      anonymous_name: reply.anonymousIdentity?.displayCode ?? identity.displayCode,
      content: reply.content,
      status: reply.status,
      created_at: reply.createdAt,
    };

    if (status === 'ACTIVE') {
      this.gateway.broadcastCommentCreated(parent.post.communityId, dto);
      if (parent.userId !== userId) {
        await this.notifications.notify(parent.userId, 'COMMENT_REPLY', parent.postId, {
          post_id: parent.postId,
          comment_id: reply.id,
          parent_comment_id: commentId,
          anonymous_name: dto.anonymous_name,
        });
      }
    }

    return dto;
  }

  async deleteComment(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.deletedAt) {
      throw new NotFoundException({
        error: 'COMMENT_NOT_FOUND',
        message: 'Comment not found',
      });
    }
    if (comment.userId !== userId) {
      throw new ForbiddenException({
        error: 'COMMENT_DELETE_FORBIDDEN',
        message: 'Cannot delete another user comment',
      });
    }
    await this.prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date(), status: 'REMOVED' },
    });
  }
}
