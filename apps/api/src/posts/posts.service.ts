import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReactionType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { IdentitiesService } from '../identities/identities.service';
import { ModerationService } from '../moderation/moderation.service';
import { ReactionsService } from '../reactions/reactions.service';
import { CommunityGateway } from '../realtime/community.gateway';
import { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identitiesService: IdentitiesService,
    private readonly moderationService: ModerationService,
    private readonly reactionsService: ReactionsService,
    private readonly gateway: CommunityGateway,
  ) {}

  async create(dto: CreatePostDto, userId: string, headerIdempotencyKey?: string) {
    const idempotencyKey = headerIdempotencyKey || dto.idempotency_key;
    if (idempotencyKey) {
      const existingKey = await this.prisma.idempotencyKey.findUnique({
        where: { userId_key: { userId, key: idempotencyKey } },
      });
      if (existingKey && existingKey.expiresAt > new Date()) {
        return this.findOne(existingKey.resourceId, userId);
      }
    }

    const community = await this.prisma.community.findUnique({
      where: { id: dto.community_id },
    });
    if (!community || community.status !== 'ACTIVE') {
      throw new NotFoundException({
        error: 'COMMUNITY_NOT_FOUND',
        message: 'Target community not found or inactive',
      });
    }

    const safety = this.moderationService.checkContentSafety(dto.content);
    if (!safety.allowed || safety.action === 'REJECT') {
      throw new BadRequestException({
        error: 'CONTENT_PII_REJECTED',
        message: 'Post contains restricted personal identifiers and cannot be published.',
      });
    }

    const identity = await this.identitiesService.getOrCreateForCommunity(
      userId,
      dto.community_id,
    );

    const postStatus = safety.action === 'HOLD_FOR_REVIEW' ? 'UNDER_REVIEW' : 'PUBLISHED';

    const post = await this.prisma.post.create({
      data: {
        userId,
        anonymousIdentityId: identity.id,
        communityId: dto.community_id,
        category: dto.category,
        content: dto.content,
        visibility: dto.visibility ?? 'COMMUNITY',
        commentsEnabled: dto.comments_enabled ?? true,
        status: postStatus,
      },
      include: { anonymousIdentity: true, community: true },
    });

    if (dto.poll) {
      const hours = dto.poll.closes_in_hours ?? 24;
      const poll = await this.prisma.poll.create({
        data: {
          postId: post.id,
          question: dto.poll.question,
          closesAt: new Date(Date.now() + hours * 60 * 60 * 1000),
        },
      });
      for (let i = 0; i < dto.poll.options.length; i++) {
        await this.prisma.pollOption.create({
          data: {
            pollId: poll.id,
            optionText: dto.poll.options[i],
            sortOrder: i,
          },
        });
      }
    }

    if (idempotencyKey) {
      await this.prisma.idempotencyKey.upsert({
        where: { userId_key: { userId, key: idempotencyKey } },
        create: {
          userId,
          key: idempotencyKey,
          resourceType: 'POST',
          resourceId: post.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        update: {
          resourceId: post.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }

    const responseDto = {
      id: post.id,
      anonymous_name: post.anonymousIdentity?.displayCode ?? identity.displayCode,
      category: post.category,
      content: post.content,
      status: post.status,
      visibility: post.visibility,
      community_id: post.communityId,
      community_name: post.community?.name ?? community.name,
      comments_enabled: post.commentsEnabled,
      comment_count: 0,
      reaction_count: 0,
      moderation_flags: safety.detectedPatterns,
      created_at: post.createdAt,
    };

    if (postStatus === 'PUBLISHED') {
      this.gateway.broadcastPostCreated(post.communityId, responseDto);
    }

    return responseDto;
  }

  async findOne(id: string, userId?: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        anonymousIdentity: true,
        community: true,
        poll: { include: { options: true } },
        _count: { select: { comments: true, reactions: true } },
      },
    });
    if (!post || post.deletedAt || post.status === 'REMOVED') {
      throw new NotFoundException({
        error: 'POST_NOT_FOUND',
        message: 'Post not found',
      });
    }

    const reactionCounts = await this.reactionsService.getCounts(id);
    let userReaction: string | null = null;
    let isSaved = false;

    if (userId) {
      const [reaction, saved] = await Promise.all([
        this.prisma.reaction.findUnique({
          where: { postId_userId: { postId: id, userId } },
        }),
        this.prisma.savedPost.findUnique({
          where: { userId_postId: { userId, postId: id } },
        }),
      ]);
      userReaction = reaction?.reactionType ?? null;
      isSaved = Boolean(saved);
    }

    return {
      id: post.id,
      anonymous_name: post.anonymousIdentity?.displayCode ?? 'Anonymous',
      category: post.category,
      content: post.content,
      status: post.status,
      visibility: post.visibility,
      community_id: post.communityId,
      community_name: post.community?.name ?? null,
      comments_enabled: post.commentsEnabled,
      comment_count: (post as any)._count?.comments ?? 0,
      reaction_count: (post as any)._count?.reactions ?? 0,
      reaction_counts: reactionCounts,
      user_reaction: userReaction,
      is_saved: isSaved,
      is_own: userId ? post.userId === userId : false,
      poll: (post as any).poll ?? null,
      created_at: post.createdAt,
    };
  }

  async remove(id: string, userId: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post || post.deletedAt) {
      throw new NotFoundException({
        error: 'POST_NOT_FOUND',
        message: 'Post not found',
      });
    }
    if (post.userId !== userId) {
      throw new ForbiddenException({
        error: 'POST_DELETE_FORBIDDEN',
        message: 'Cannot delete another user post',
      });
    }

    await this.prisma.post.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'REMOVED' },
    });
  }

  async react(postId: string, reactionType: ReactionType, userId: string) {
    return this.reactionsService.react(postId, reactionType, userId);
  }

  async unreact(postId: string, userId: string) {
    return this.reactionsService.unreact(postId, userId);
  }

  async save(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) {
      throw new NotFoundException({
        error: 'POST_NOT_FOUND',
        message: 'Post not found',
      });
    }

    await this.prisma.savedPost.upsert({
      where: { userId_postId: { userId, postId } },
      create: { userId, postId },
      update: {},
    });
    return { saved: true, post_id: postId };
  }

  async unsave(postId: string, userId: string) {
    await this.prisma.savedPost.deleteMany({ where: { postId, userId } });
    return { saved: false, post_id: postId };
  }

  async getMyAuthoredPosts(userId: string) {
    const posts = await this.prisma.post.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        anonymousIdentity: true,
        community: true,
        _count: { select: { comments: true, reactions: true } },
      },
    });
    return {
      data: posts.map((p) => ({
        id: p.id,
        anonymous_name: p.anonymousIdentity?.displayCode ?? 'Anonymous',
        category: p.category,
        content: p.content,
        status: p.status,
        community_id: p.communityId,
        community_name: p.community?.name ?? null,
        comment_count: (p as any)._count?.comments ?? 0,
        reaction_count: (p as any)._count?.reactions ?? 0,
        created_at: p.createdAt,
      })),
    };
  }

  async getMySavedPosts(userId: string) {
    const saved = await this.prisma.savedPost.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        post: {
          include: {
            anonymousIdentity: true,
            community: true,
            _count: { select: { comments: true, reactions: true } },
          },
        },
      },
    });

    const data = saved
      .map((s) => (s as any).post)
      .filter((p) => p && !p.deletedAt && p.status === 'PUBLISHED')
      .map((p) => ({
        id: p.id,
        anonymous_name: p.anonymousIdentity?.displayCode ?? 'Anonymous',
        category: p.category,
        content: p.content,
        status: p.status,
        community_id: p.communityId,
        community_name: p.community?.name ?? null,
        comment_count: p._count?.comments ?? 0,
        reaction_count: p._count?.reactions ?? 0,
        created_at: p.createdAt,
      }));

    return { data };
  }

  async votePoll(postId: string, optionId: string, userId: string) {
    const poll = await this.prisma.poll.findUnique({ where: { postId } });
    if (!poll) {
      throw new NotFoundException({
        error: 'POLL_NOT_FOUND',
        message: 'Poll not found for this post',
      });
    }
    if (poll.closesAt < new Date()) {
      throw new BadRequestException({
        error: 'POLL_CLOSED',
        message: 'This poll has closed',
      });
    }

    const option = await this.prisma.pollOption.findUnique({ where: { id: optionId } });
    if (!option || option.pollId !== poll.id) {
      throw new NotFoundException({
        error: 'POLL_OPTION_NOT_FOUND',
        message: 'Poll option not found',
      });
    }

    await this.prisma.pollVote.upsert({
      where: { pollId_userId: { pollId: poll.id, userId } },
      create: { pollId: poll.id, userId, pollOptionId: optionId },
      update: { pollOptionId: optionId },
    });

    const [options, votes] = await Promise.all([
      this.prisma.pollOption.findMany({
        where: { pollId: poll.id },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.pollVote.findMany({ where: { pollId: poll.id } }),
    ]);

    return {
      poll_id: poll.id,
      total_votes: votes.length,
      user_option_id: optionId,
      options: options.map((opt) => ({
        id: opt.id,
        option_text: opt.optionText,
        votes: votes.filter((v) => v.pollOptionId === opt.id).length,
      })),
    };
  }
}
