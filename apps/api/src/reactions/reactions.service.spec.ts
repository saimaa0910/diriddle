import { Test, TestingModule } from '@nestjs/testing';
import { ReactionType } from '@prisma/client';
import { ReactionsService } from './reactions.service';
import { PrismaService } from '../database/prisma.service';
import { InMemoryPrismaStore } from '../database/in-memory-prisma';
import { CommunityGateway } from '../realtime/community.gateway';
import { NotificationsService } from '../notifications/notifications.service';

describe('ReactionsService', () => {
  let service: ReactionsService;
  let store: InMemoryPrismaStore;
  let postId: string;
  let commentId: string;
  let authorId: string;
  let reactorId: string;

  const mockGateway = { broadcastReactionUpdated: jest.fn() };
  const mockNotifications = { notify: jest.fn().mockResolvedValue(null) };

  beforeEach(async () => {
    store = new InMemoryPrismaStore();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReactionsService,
        { provide: PrismaService, useValue: store },
        { provide: CommunityGateway, useValue: mockGateway },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get(ReactionsService);

    const author = await store.user.create({ data: { authId: 'phone:+91-react-author-1' } });
    authorId = author.id;
    const reactor = await store.user.create({ data: { authId: 'phone:+91-react-reactor-1' } });
    reactorId = reactor.id;

    const post = await store.post.create({
      data: {
        userId: authorId,
        communityId: 'comm-bengaluru',
        content: 'Post to react to',
        category: 'GENERAL',
        status: 'PUBLISHED',
        isDraft: false,
        isPinned: false,
      },
    });
    postId = post.id;

    const comment = await store.comment.create({
      data: {
        postId: post.id,
        userId: authorId,
        anonymousIdentityId: 'ident-demo-1',
        content: 'Comment to react to',
        status: 'ACTIVE',
      },
    });
    commentId = comment.id;
  });

  describe('Post Reactions', () => {
    it('adds a reaction and returns correct counts', async () => {
      const result = await service.react(postId, ReactionType.LIKE, reactorId);
      expect(result.user_reaction).toBe(ReactionType.LIKE);
      expect(result.reaction_counts[ReactionType.LIKE]).toBe(1);
      expect(result.total_reactions).toBe(1);
    });

    it('toggles off reaction when same type is submitted twice', async () => {
      await service.react(postId, ReactionType.LIKE, reactorId);
      const result = await service.react(postId, ReactionType.LIKE, reactorId);
      expect(result.user_reaction).toBeNull();
      expect(result.total_reactions).toBe(0);
    });

    it('changes reaction type when a different type is submitted', async () => {
      await service.react(postId, ReactionType.LIKE, reactorId);
      const result = await service.react(postId, ReactionType.LAUGH, reactorId);
      expect(result.user_reaction).toBe(ReactionType.LAUGH);
      expect(result.reaction_counts[ReactionType.LAUGH]).toBe(1);
      expect(result.reaction_counts[ReactionType.LIKE] ?? 0).toBe(0);
    });

    it('removes reaction with unreact()', async () => {
      await service.react(postId, ReactionType.LIKE, reactorId);
      const result = await service.unreact(postId, reactorId);
      expect(result.user_reaction).toBeNull();
      expect(result.total_reactions).toBe(0);
    });

    it('sends a notification to post author when reactor is different', async () => {
      await service.react(postId, ReactionType.WOW, reactorId);
      expect(mockNotifications.notify).toHaveBeenCalledWith(
        authorId,
        'REACTION',
        postId,
        expect.objectContaining({ reaction_type: ReactionType.WOW }),
      );
    });

    it('does not notify when author reacts to own post', async () => {
      mockNotifications.notify.mockClear();
      await service.react(postId, ReactionType.LIKE, authorId);
      expect(mockNotifications.notify).not.toHaveBeenCalled();
    });

    it('getCounts returns empty object when no reactions', async () => {
      const counts = await service.getCounts(postId);
      expect(Object.keys(counts)).toHaveLength(0);
    });

    it('getCounts returns accurate counts for multiple reactors', async () => {
      const reactor2 = await store.user.create({ data: { authId: 'phone:+91-react-r2' } });
      await service.react(postId, ReactionType.LIKE, reactorId);
      await service.react(postId, ReactionType.LIKE, reactor2.id);
      const counts = await service.getCounts(postId);
      expect(counts[ReactionType.LIKE]).toBe(2);
    });
  });

  describe('Comment Reactions', () => {
    it('adds a reaction to a comment and returns updated counts', async () => {
      const result = await service.reactToComment(commentId, ReactionType.HEART, reactorId);
      expect(result.user_reaction).toBe(ReactionType.HEART);
      expect(result.total_reactions).toBe(1);
      expect(result.reaction_counts[ReactionType.HEART]).toBe(1);
    });

    it('toggles off comment reaction when submitted twice', async () => {
      await service.reactToComment(commentId, ReactionType.LIKE, reactorId);
      const result = await service.reactToComment(commentId, ReactionType.LIKE, reactorId);
      expect(result.user_reaction).toBeNull();
      expect(result.total_reactions).toBe(0);
    });

    it('unreacts from comment with unreactComment()', async () => {
      await service.reactToComment(commentId, ReactionType.LAUGH, reactorId);
      const result = await service.unreactComment(commentId, reactorId);
      expect(result.user_reaction).toBeNull();
      expect(result.total_reactions).toBe(0);
    });

    it('getCommentCounts returns accurate counts', async () => {
      const reactor2 = await store.user.create({ data: { authId: 'phone:+91-react-r3' } });
      await service.reactToComment(commentId, ReactionType.WOW, reactorId);
      await service.reactToComment(commentId, ReactionType.WOW, reactor2.id);
      const counts = await service.getCommentCounts(commentId);
      expect(counts[ReactionType.WOW]).toBe(2);
    });
  });
});
