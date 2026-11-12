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
});
