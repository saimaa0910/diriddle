import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReactionType, Visibility } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { IdentitiesService } from '../identities/identities.service';
import { ModerationService } from '../moderation/moderation.service';
import { ReactionsService } from '../reactions/reactions.service';
import { CommunityGateway } from '../realtime/community.gateway';
import { HashtagService } from './hashtag.service';
import { MentionService } from './mention.service';
import { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identitiesService: IdentitiesService,
    private readonly moderationService: ModerationService,
    private readonly reactionsService: ReactionsService,
    private readonly gateway: CommunityGateway,
    private readonly hashtagService: HashtagService,
    private readonly mentionService: MentionService,
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

    const isDraft = dto.is_draft ?? false;
    const postStatus = isDraft
      ? 'DRAFT'
      : safety.action === 'HOLD_FOR_REVIEW'
        ? 'UNDER_REVIEW'
        : 'PUBLISHED';

    const { post, poll } = await this.prisma.$transaction(async (tx: any) => {
      const post = await tx.post.create({
        data: {
          userId,
          anonymousIdentityId: identity.id,
          communityId: dto.community_id,
          category: dto.category,
          content: dto.content,
          visibility: dto.visibility ?? 'COMMUNITY',
          commentsEnabled: dto.comments_enabled ?? true,
          status: postStatus,
          isDraft,
          isPinned: false,
        },
        include: { anonymousIdentity: true, community: true },
      });

      if (dto.visibility === 'SELECTED_COMMUNITIES' && dto.audience_community_ids) {
        for (const targetCommId of dto.audience_community_ids) {
          await tx.postAudience.create({
            data: { postId: post.id, communityId: targetCommId },
          });
        }
      }

      if (dto.attachment_ids && dto.attachment_ids.length > 0) {
        await tx.attachment.updateMany({
          where: { id: { in: dto.attachment_ids } },
          data: { postId: post.id },
        });
      }

      let poll: any = null;
      if (dto.poll) {
        const hours = dto.poll.closes_in_hours ?? 24;
        poll = await tx.poll.create({
          data: {
            postId: post.id,
            question: dto.poll.question,
            closesAt: new Date(Date.now() + hours * 60 * 60 * 1000),
          },
        });
        const optionsData = dto.poll.options.map((optionText: string, idx: number) => ({
          pollId: poll.id,
          optionText,
          sortOrder: idx,
        }));
        await tx.pollOption.createMany({
          data: optionsData,
        });
        const options = await tx.pollOption.findMany({
          where: { pollId: poll.id },
          orderBy: { sortOrder: 'asc' },
        });
        poll = { ...poll, options };
      }

      if (idempotencyKey) {
        await tx.idempotencyKey.upsert({
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

      return { post, poll };
    });

    // Process hashtags
    const hashtags = this.hashtagService.extractHashtags(post.content);
    if (hashtags.length > 0) {
      await this.hashtagService.upsertPostHashtags(post.id, hashtags);
    }

    // Process mentions
    await this.mentionService.resolveAndNotifyMentions(
      post.content,
      post.communityId,
      post.id,
    );

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
      poll: poll ?? null,
      hashtags: hashtags.map((t) => `#${t}`),
      is_draft: post.isDraft,
      is_pinned: post.isPinned,
      created_at: post.createdAt,
    };

    if (postStatus === 'PUBLISHED') {
      if (typeof (this.gateway as any).broadcastNewPost === 'function') {
        (this.gateway as any).broadcastNewPost(post.communityId, responseDto);
      } else {
        this.gateway.broadcastPostCreated(post.communityId, responseDto);
      }
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
      is_draft: post.isDraft,
      is_pinned: post.isPinned,
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

  async pinPost(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) {
      throw new NotFoundException({ error: 'POST_NOT_FOUND', message: 'Post not found' });
    }

    const isStaff = await this.isCommunityStaff(post.communityId, userId);
    if (!isStaff) {
      throw new ForbiddenException({ error: 'FORBIDDEN_PIN', message: 'Staff only' });
    }

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: { isPinned: true },
    });

    return { id: updated.id, is_pinned: true };
  }

  async unpinPost(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) {
      throw new NotFoundException({ error: 'POST_NOT_FOUND', message: 'Post not found' });
    }

    const isStaff = await this.isCommunityStaff(post.communityId, userId);
    if (!isStaff) {
      throw new ForbiddenException({ error: 'FORBIDDEN_UNPIN', message: 'Staff only' });
    }

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: { isPinned: false },
    });

    return { id: updated.id, is_pinned: false };
  }

  async hidePost(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) {
      throw new NotFoundException({ error: 'POST_NOT_FOUND', message: 'Post not found' });
    }

    const isStaff = await this.isCommunityStaff(post.communityId, userId);
    if (post.userId !== userId && !isStaff) {
      throw new ForbiddenException({
        error: 'FORBIDDEN_HIDE',
        message: 'Only author or community staff can hide this post',
      });
    }

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: { status: 'HIDDEN' as any },
    });

    return { id: updated.id, status: 'HIDDEN', hidden: true };
  }

  async unhidePost(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) {
      throw new NotFoundException({ error: 'POST_NOT_FOUND', message: 'Post not found' });
    }

    const isStaff = await this.isCommunityStaff(post.communityId, userId);
    if (post.userId !== userId && !isStaff) {
      throw new ForbiddenException({
        error: 'FORBIDDEN_UNHIDE',
        message: 'Only author or community staff can unhide this post',
      });
    }

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: { status: 'PUBLISHED' },
    });

    return { id: updated.id, status: 'PUBLISHED', hidden: false };
  }

  async sharePost(postId: string, _userId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt || post.status === 'REMOVED') {
      throw new NotFoundException({ error: 'POST_NOT_FOUND', message: 'Post not found' });
    }

    return {
      post_id: post.id,
      share_url: `/posts/${post.id}`,
      shareable: post.visibility === 'PUBLIC' || post.visibility === 'COMMUNITY',
    };
  }

  async publishDraft(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) {
      throw new NotFoundException({ error: 'POST_NOT_FOUND', message: 'Post not found' });
    }
    if (post.userId !== userId) {
      throw new ForbiddenException({ error: 'FORBIDDEN_PUBLISH', message: 'Author only' });
    }

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: { status: 'PUBLISHED', isDraft: false },
    });

    return { id: updated.id, status: 'PUBLISHED', is_draft: false };
  }

  async update(
    postId: string,
    userId: string,
    dto: { content?: string; category?: any; commentsEnabled?: boolean },
  ) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) {
      throw new NotFoundException({ error: 'POST_NOT_FOUND', message: 'Post not found' });
    }
    if (post.userId !== userId) {
      throw new ForbiddenException({ error: 'FORBIDDEN_EDIT', message: 'Author only' });
    }

    if (dto.content) {
      const safety = this.moderationService.checkContentSafety(dto.content);
      if (!safety.allowed || safety.action === 'REJECT') {
        throw new BadRequestException({
          error: 'CONTENT_PII_REJECTED',
          message: 'Edited content contains restricted personal identifiers.',
        });
      }
    }

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: {
        ...(dto.content ? { content: dto.content } : {}),
        ...(dto.category ? { category: dto.category } : {}),
        ...(dto.commentsEnabled !== undefined ? { commentsEnabled: dto.commentsEnabled } : {}),
      },
    });

    if (dto.content) {
      await this.hashtagService.removePostHashtags(postId);
      const hashtags = this.hashtagService.extractHashtags(dto.content);
      await this.hashtagService.upsertPostHashtags(postId, hashtags);
    }

    return { id: updated.id, content: updated.content, updated_at: updated.updatedAt };
  }

  private async isCommunityStaff(communityId: string, userId: string): Promise<boolean> {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (community?.ownerId === userId) return true;

    const role = await this.prisma.communityRole.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    return role?.role === 'OWNER' || role?.role === 'MODERATOR';
  }
}

