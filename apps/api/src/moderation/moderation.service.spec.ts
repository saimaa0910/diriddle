import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ModerationActionType } from '@prisma/client';
import { ModerationService } from './moderation.service';
import { PrismaService } from '../database/prisma.service';
import { InMemoryPrismaStore } from '../database/in-memory-prisma';

describe('ModerationService', () => {
  let service: ModerationService;
  let store: InMemoryPrismaStore;

  beforeEach(async () => {
    store = new InMemoryPrismaStore();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        { provide: PrismaService, useValue: store },
      ],
    }).compile();

    service = module.get(ModerationService);
  });

  it('allows clean content to publish immediately', () => {
    const result = service.checkContentSafety('Best filter coffee spot in Indiranagar?');
    expect(result.allowed).toBe(true);
    expect(result.action).toBe('PUBLISH');
  });

  it('flags phone numbers and emails for review', () => {
    const result = service.checkContentSafety('Contact me at test@example.com or 9876543210');
    expect(result.action).toBe('HOLD_FOR_REVIEW');
    expect(result.detectedPatterns).toContain('EMAIL');
    expect(result.detectedPatterns).toContain('PHONE_NUMBER');
  });

  it('rejects Aadhaar/PAN patterns automatically', () => {
    const result = service.checkContentSafety('PAN ABCDE1234F leaked');
    expect(result.allowed).toBe(false);
    expect(result.action).toBe('REJECT');
    expect(result.detectedPatterns).toContain('PAN_NUMBER');
  });

  it('executes REMOVE moderation action and writes immutable audit log', async () => {
    const action = await service.takeAction('user-demo-admin', {
      target_type: 'POST',
      target_id: 'post-demo-1',
      action_type: ModerationActionType.REMOVE,
      reason: 'Confirmed policy violation',
    });
    expect(action.action_type).toBe(ModerationActionType.REMOVE);

    const post = await store.post.findUnique({ where: { id: 'post-demo-1' } });
    expect(post?.status).toBe('REMOVED');

    const logs = await store.auditLog.findMany({ where: { resourceId: 'post-demo-1' } });
    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe('MODERATION_REMOVE');
  });

  describe('submitAppeal', () => {
    it('allows content owner to appeal moderation action on their post', async () => {
      const owner = await store.user.create({ data: { authId: 'phone:+919811111111' } });
      const post = await store.post.create({
        data: {
          userId: owner.id,
          communityId: 'comm-bengaluru',
          content: 'Borderline post',
          category: 'CONFESSION',
        },
      });

      const action = await store.moderationAction.create({
        data: {
          moderatorId: 'user-demo-admin',
          targetType: 'POST',
          targetId: post.id,
          actionType: 'REMOVE',
          reason: 'Removed by mistake',
        },
      });

      const appeal = await service.submitAppeal(
        owner.id,
        action.id,
        'This post followed community guidelines and did not violate policies.',
      );
      expect(appeal.id).toBeDefined();
      expect(appeal.status).toBe('PENDING');
      expect(appeal.moderation_action_id).toBe(action.id);
    });

    it('rejects appeal when user does not own the moderated post (DIR-034)', async () => {
      const owner = await store.user.create({ data: { authId: 'phone:+919822222222' } });
      const bystander = await store.user.create({ data: { authId: 'phone:+919833333333' } });

      const post = await store.post.create({
        data: {
          userId: owner.id,
          communityId: 'comm-bengaluru',
          content: 'Original post',
          category: 'CONFESSION',
        },
      });

      const action = await store.moderationAction.create({
        data: {
          moderatorId: 'user-demo-admin',
          targetType: 'POST',
          targetId: post.id,
          actionType: 'REMOVE',
          reason: 'Policy violation',
        },
      });

      await expect(
        service.submitAppeal(bystander.id, action.id, 'I think this was fine.'),
      ).rejects.toMatchObject({
        response: {
          error: 'FORBIDDEN_APPEAL',
          message: 'You can only appeal moderation actions taken on your own content',
        },
      });
    });

    it('allows comment owner to appeal moderation action on their comment', async () => {
      const owner = await store.user.create({ data: { authId: 'phone:+919844444444' } });
      const comment = await store.comment.create({
        data: {
          userId: owner.id,
          postId: 'post-demo-1',
          content: 'Comment subject to moderation',
        },
      });

      const action = await store.moderationAction.create({
        data: {
          moderatorId: 'user-demo-admin',
          targetType: 'COMMENT',
          targetId: comment.id,
          actionType: 'REMOVE',
          reason: 'Policy violation',
        },
      });

      const appeal = await service.submitAppeal(
        owner.id,
        action.id,
        'I am appealing the removal of my comment.',
      );
      expect(appeal.id).toBeDefined();
      expect(appeal.status).toBe('PENDING');
    });

    it('rejects appeal when user does not own the moderated comment', async () => {
      const owner = await store.user.create({ data: { authId: 'phone:+919855555555' } });
      const bystander = await store.user.create({ data: { authId: 'phone:+919866666666' } });

      const comment = await store.comment.create({
        data: {
          userId: owner.id,
          postId: 'post-demo-1',
          content: 'Comment',
        },
      });

      const action = await store.moderationAction.create({
        data: {
          moderatorId: 'user-demo-admin',
          targetType: 'COMMENT',
          targetId: comment.id,
          actionType: 'REMOVE',
          reason: 'Spam',
        },
      });

      await expect(
        service.submitAppeal(bystander.id, action.id, 'I am appealing for another user.'),
      ).rejects.toMatchObject({
        response: {
          error: 'FORBIDDEN_APPEAL',
          message: 'You can only appeal moderation actions taken on your own content',
        },
      });
    });

    it('throws NotFoundException when moderation action does not exist', async () => {
      await expect(
        service.submitAppeal('user-demo-admin', 'non-existent-action', 'Appeal reason'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
