import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BlocksService } from './blocks.service';
import { PrismaService } from '../database/prisma.service';
import { InMemoryPrismaStore } from '../database/in-memory-prisma';

describe('BlocksService', () => {
  let service: BlocksService;
  let store: InMemoryPrismaStore;

  beforeEach(async () => {
    store = new InMemoryPrismaStore();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlocksService,
        { provide: PrismaService, useValue: store },
      ],
    }).compile();

    service = module.get(BlocksService);
  });

  it('prevents self-blocking', async () => {
    await expect(service.block('user-demo-admin', 'user-demo-admin')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects blocking non-existent user', async () => {
    await expect(service.block('user-demo-admin', 'non-existent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('blocks and unblocks another user cleanly', async () => {
    const u2 = await store.user.create({ data: { authId: 'phone:+919444444444' } });
    const res = await service.block('user-demo-admin', u2.id);
    expect(res.blocked).toBe(true);

    const list = await service.getBlocked('user-demo-admin');
    expect(list.data).toHaveLength(1);
    expect(list.data[0].user_id).toBe(u2.id);

    const unblocked = await service.unblock('user-demo-admin', u2.id);
    expect(unblocked.blocked).toBe(false);

    const listAfter = await service.getBlocked('user-demo-admin');
    expect(listAfter.data).toHaveLength(0);
  });

  describe('blockByContent', () => {
    it('blocks post author anonymously and omits author userId from return', async () => {
      const author = await store.user.create({ data: { authId: 'phone:+919111111111' } });
      const viewer = await store.user.create({ data: { authId: 'phone:+919222222222' } });

      const post = await store.post.create({
        data: {
          userId: author.id,
          communityId: 'comm-bengaluru',
          content: 'Confession post',
          category: 'CONFESSION',
        },
      });

      const res = await service.blockByContent(viewer.id, 'POST', post.id, 'Spam content');
      expect(res.success).toBe(true);
      expect(res.message).toBe('Author blocked successfully');
      expect((res as any).userId).toBeUndefined();
      expect((res as any).authorId).toBeUndefined();

      const blockedIds = await service.getBlockedUserIds(viewer.id);
      expect(blockedIds).toContain(author.id);
    });

    it('blocks comment author anonymously', async () => {
      const author = await store.user.create({ data: { authId: 'phone:+919333333333' } });
      const viewer = await store.user.create({ data: { authId: 'phone:+919444444444' } });

      const comment = await store.comment.create({
        data: {
          userId: author.id,
          postId: 'post-demo-1',
          content: 'Nasty comment',
        },
      });

      const res = await service.blockByContent(viewer.id, 'COMMENT', comment.id);
      expect(res.success).toBe(true);

      const blockedIds = await service.getBlockedUserIds(viewer.id);
      expect(blockedIds).toContain(author.id);
    });

    it('throws NotFoundException when target post does not exist', async () => {
      await expect(
        service.blockByContent('user-demo-admin', 'POST', 'non-existent-post'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when target comment does not exist', async () => {
      await expect(
        service.blockByContent('user-demo-admin', 'COMMENT', 'non-existent-comment'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException with SELF_BLOCK_FORBIDDEN when user blocks their own post', async () => {
      const author = await store.user.create({ data: { authId: 'phone:+919555555555' } });
      const post = await store.post.create({
        data: {
          userId: author.id,
          communityId: 'comm-bengaluru',
          content: 'My own post',
          category: 'CONFESSION',
        },
      });

      await expect(service.blockByContent(author.id, 'POST', post.id)).rejects.toMatchObject({
        response: {
          error: 'SELF_BLOCK_FORBIDDEN',
          message: 'You cannot block yourself',
        },
      });
    });

    it('is idempotent when block already exists', async () => {
      const author = await store.user.create({ data: { authId: 'phone:+919666666666' } });
      const viewer = await store.user.create({ data: { authId: 'phone:+919777777777' } });

      const post = await store.post.create({
        data: {
          userId: author.id,
          communityId: 'comm-bengaluru',
          content: 'Some post',
          category: 'CONFESSION',
        },
      });

      const res1 = await service.blockByContent(viewer.id, 'POST', post.id);
      expect(res1.success).toBe(true);

      const res2 = await service.blockByContent(viewer.id, 'POST', post.id);
      expect(res2.success).toBe(true);
    });
  });
});
