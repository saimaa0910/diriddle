import { Test, TestingModule } from '@nestjs/testing';
import { PostCategory } from '@prisma/client';
import { FeedService } from './feed.service';
import { BlocksService } from '../blocks/blocks.service';
import { PrismaService } from '../database/prisma.service';
import { InMemoryPrismaStore } from '../database/in-memory-prisma';

describe('FeedService', () => {
  let service: FeedService;
  let blocksService: BlocksService;
  let store: InMemoryPrismaStore;

  beforeEach(async () => {
    store = new InMemoryPrismaStore();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedService,
        BlocksService,
        { provide: PrismaService, useValue: store },
      ],
    }).compile();

    service = module.get(FeedService);
    blocksService = module.get(BlocksService);
  });

  it('returns latest published posts with cursor pagination', async () => {
    const page1 = await service.getLatest({ userId: 'viewer-1', limit: 2 });
    expect(page1.data).toHaveLength(2);
    expect(page1.has_more).toBe(true);
    expect(page1.next_cursor).toBeTruthy();

    const page2 = await service.getLatest({
      userId: 'viewer-1',
      limit: 2,
      cursor: page1.next_cursor!,
    });
    expect(page2.data.length).toBeGreaterThan(0);
    expect(page2.data[0].id).not.toBe(page1.data[0].id);
  });

  it('filters out posts from blocked users', async () => {
    const viewer = await store.user.create({ data: { authId: 'phone:+919333333333' } });
    await blocksService.block(viewer.id, 'user-demo-admin');

    const feed = await service.getLatest({ userId: viewer.id, limit: 20 });
    expect(feed.data).toHaveLength(0);
  });

  it('filters feed by category', async () => {
    const res = await service.getByCategory({
      userId: 'viewer-1',
      category: PostCategory.LOCAL_ALERT,
      limit: 10,
    });
    expect(res.data.length).toBe(1);
    expect(res.data[0].category).toBe(PostCategory.LOCAL_ALERT);
  });
});
