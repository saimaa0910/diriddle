import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { PrismaService } from '../database/prisma.service';
import { InMemoryPrismaStore } from '../database/in-memory-prisma';
import { IdentitiesService } from '../identities/identities.service';
import { ModerationService } from '../moderation/moderation.service';
import { BlocksService } from '../blocks/blocks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CommunityGateway } from '../realtime/community.gateway';

describe('CommentsService', () => {
  let service: CommentsService;
  let store: InMemoryPrismaStore;
  let postId: string;
  let communityId: string;
  let authorId: string;
  let commenterId: string;

  const mockGateway = {
    broadcastCommentCreated: jest.fn(),
    sendNotification: jest.fn(),
  };
  const mockNotifications = {
    notify: jest.fn().mockResolvedValue(null),
  };

  beforeEach(async () => {
    store = new InMemoryPrismaStore();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        IdentitiesService,
        ModerationService,
        BlocksService,
        { provide: PrismaService, useValue: store },
        { provide: CommunityGateway, useValue: mockGateway },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get(CommentsService);

    // Set up seed data for most tests
    communityId = 'comm-bengaluru';

    const author = await store.user.create({ data: { authId: 'phone:+91-auth-author-1' } });
    authorId = author.id;

    const commenter = await store.user.create({ data: { authId: 'phone:+91-auth-commenter-1' } });
    commenterId = commenter.id;

    // Need an identity to allow community posts; seed the identity
    await store.anonymousIdentity.create({
      data: { userId: authorId, communityId, displayCode: 'Anonymous #1001', isGlobal: false },
    });

    const post = await store.post.create({
      data: {
        userId: authorId,
        communityId,
        content: 'Test post for comments',
        category: 'GENERAL',
        status: 'PUBLISHED',
        commentsEnabled: true,
        isDraft: false,
        isPinned: false,
      },
    });
    postId = post.id;
  });

  it('creates a comment on an active post and returns anonymous_name', async () => {
    const result = await service.createComment(postId, 'Great post!', commenterId);

    expect(result.id).toBeDefined();
    expect(result.post_id).toBe(postId);
    expect(result.anonymous_name).toMatch(/^Anonymous #\d{4}$/);
    expect(result.content).toBe('Great post!');
    expect(result.status).toBe('ACTIVE');
  });

  it('returns is_own=true only for the commenter', async () => {
    await service.createComment(postId, 'My comment', commenterId);

    const list = await service.getComments(postId, commenterId, { limit: 20 });
    expect(list.data[0].is_own).toBe(true);

    const listOther = await service.getComments(postId, authorId, { limit: 20 });
    expect(listOther.data[0].is_own).toBe(false);
  });

  it('creates a threaded reply to a comment', async () => {
    const comment = await service.createComment(postId, 'Parent comment', commenterId);
    const reply = await service.createReply(comment.id, 'Nested reply', authorId);

    expect(reply.parent_comment_id).toBe(comment.id);
    expect(reply.anonymous_name).toMatch(/^Anonymous #\d{4}$/);
  });

  it('throws NotFoundException when replying to a non-existent comment', async () => {
    await expect(service.createReply('no-such-comment', 'Reply', commenterId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException when commenting on a non-existent post', async () => {
    await expect(service.createComment('no-such-post', 'Hello', commenterId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects comment when comments are disabled on the post', async () => {
    const noCommentPost = await store.post.create({
      data: {
        userId: authorId,
        communityId,
        content: 'Post with comments disabled',
        category: 'GENERAL',
        status: 'PUBLISHED',
        commentsEnabled: false,
        isDraft: false,
        isPinned: false,
      },
    });

    await expect(
      service.createComment(noCommentPost.id, 'Should fail', commenterId),
    ).rejects.toThrow(ForbiddenException);
  });

  it('holds comment with PII content for review (phone number)', async () => {
    const result = await service.createComment(postId, 'Call me on 9876543210', commenterId);
    expect(result.status).toBe('FLAGGED');
  });

  it('rejects comment with Aadhaar number pattern', async () => {
    await expect(
      service.createComment(postId, 'Aadhaar: 1234 5678 9012', commenterId),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows comment author to delete own comment', async () => {
    const comment = await service.createComment(postId, 'Delete me', commenterId);
    await expect(service.deleteComment(comment.id, commenterId)).resolves.not.toThrow();

    const updated = await store.comment.findUnique({ where: { id: comment.id } });
    expect(updated?.status).toBe('REMOVED');
    expect(updated?.deletedAt).toBeDefined();
  });

  it('throws ForbiddenException when trying to delete another user comment', async () => {
    const comment = await service.createComment(postId, 'Not yours', commenterId);
    await expect(service.deleteComment(comment.id, authorId)).rejects.toThrow(ForbiddenException);
  });

  it('paginates comments with cursor', async () => {
    // Create 3 comments with slight delay to ensure distinct timestamps
    await service.createComment(postId, `Comment 0`, commenterId);
    await new Promise((r) => setTimeout(r, 5));
    await service.createComment(postId, `Comment 1`, commenterId);
    await new Promise((r) => setTimeout(r, 5));
    await service.createComment(postId, `Comment 2`, commenterId);

    // First page: limit 2
    const page1 = await service.getComments(postId, commenterId, { limit: 2 });
    expect(page1.data).toHaveLength(2);
    expect(page1.has_more).toBe(true);
    expect(page1.next_cursor).toBeDefined();

    // Second page: should include the remaining comment
    const page2 = await service.getComments(postId, commenterId, {
      limit: 2,
      cursor: page1.next_cursor!,
    });
    expect(page2.data.length).toBeGreaterThanOrEqual(1);
    expect(page2.has_more).toBe(false);
  });

  it('filters out comments from blocked users', async () => {
    const blocked = await store.user.create({ data: { authId: 'phone:+91-blocked-user-1' } });
    // Set up identity for blocked user
    await store.anonymousIdentity.create({
      data: {
        userId: blocked.id,
        communityId,
        displayCode: 'Anonymous #9999',
        isGlobal: false,
      },
    });
    // Block the user
    await store.block.create({ data: { blockerId: commenterId, blockedId: blocked.id } });

    // blocked user creates a comment
    await service.createComment(postId, 'You should not see this', blocked.id);
    // commenter creates one too
    await service.createComment(postId, 'Visible comment', commenterId);

    const list = await service.getComments(postId, commenterId, { limit: 20 });
    // Should only see the non-blocked comment
    const contents = list.data.map((c: any) => c.content);
    expect(contents).toContain('Visible comment');
    expect(contents).not.toContain('You should not see this');
  });
});
