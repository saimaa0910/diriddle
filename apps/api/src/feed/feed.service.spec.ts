import { BadRequestException } from '@nestjs/common';
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

  it('rejects invalid feed categories with BadRequestException', async () => {
    await expect(
      service.getByCategory('NONEXISTENT_CATEGORY', 'viewer-1', { limit: 10 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('supports positional arguments and lowercase categories in getByCategory', async () => {
    const res = await service.getByCategory('local_alert', 'viewer-1', { limit: 10 });
    expect(res.data.length).toBe(1);
    expect(res.data[0].category).toBe(PostCategory.LOCAL_ALERT);
  });

  it('retrieves city-specific feed', async () => {
    const res = await service.getCityFeed('bengaluru', { userId: 'viewer-1' });
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data[0].city).toBe('Bengaluru');
  });

  it('retrieves public feed', async () => {
    const res = await service.getPublicFeed({ userId: 'viewer-1', limit: 5 });
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('retrieves personalized feed based on user membership and location preference', async () => {
    const user = await store.user.create({ data: { authId: 'phone:+919777777777' } });
    await store.communityMember.create({
      data: {
        userId: user.id,
        communityId: 'comm-delhi',
        status: 'ACTIVE',
      },
    });
    await store.locationPreference.create({
      data: {
        userId: user.id,
        selectedCity: 'Delhi',
      },
    });

    const res = await service.getPersonalizedFeed(user.id, { userId: user.id, limit: 10 });
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('retrieves feed filtered by hashtag', async () => {
    const tag = await store.hashtag.create({ data: { tag: 'traffic', postCount: 1 } });
    await store.postHashtag.create({
      data: { postId: 'post-demo-1', hashtagId: tag.id },
    });

    const res = await service.getByHashtag('traffic', 'viewer-1');
    expect(res.data.length).toBe(1);
    expect(res.data[0].id).toBe('post-demo-1');

    const empty = await service.getByHashtag('nonexistent', 'viewer-1');
    expect(empty.data).toHaveLength(0);
  });
});

