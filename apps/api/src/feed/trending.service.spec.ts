import { Test, TestingModule } from '@nestjs/testing';
import { TrendingService } from './trending.service';
import { BlocksService } from '../blocks/blocks.service';
import { PrismaService } from '../database/prisma.service';
import { InMemoryPrismaStore } from '../database/in-memory-prisma';

describe('TrendingService', () => {
  let service: TrendingService;
  let store: InMemoryPrismaStore;

  beforeEach(async () => {
    store = new InMemoryPrismaStore();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrendingService,
        BlocksService,
        { provide: PrismaService, useValue: store },
      ],
    }).compile();

    service = module.get(TrendingService);
  });

  it('calculates score with time-decay formula', () => {
    const now = new Date('2026-03-01T12:00:00Z');
    const createdAt1 = new Date('2026-03-01T11:00:00Z'); // 1 hour ago
    const createdAt2 = new Date('2026-02-28T12:00:00Z'); // 24 hours ago

    const scoreRecent = service.calculateScore(10, 5, createdAt1, now);
    const scoreOld = service.calculateScore(10, 5, createdAt2, now);

    // Recent post should score substantially higher than 24h old post with same engagement
    expect(scoreRecent).toBeGreaterThan(scoreOld);
    expect(scoreRecent).toBeGreaterThan(0);
  });

  it('refreshes trending scores and queries persisted trending posts', async () => {
    const res = await service.refreshTrendingScores('bengaluru');
    expect(res.processed).toBeGreaterThanOrEqual(1);

    const trending = await service.getTrendingPosts({
      userId: 'user-viewer-1',
      citySlug: 'bengaluru',
    });

    expect(trending.data.length).toBeGreaterThan(0);
    expect(trending.data[0].anonymous_name).toBeDefined();
    expect(trending.data[0].trending_score).toBeDefined();
  });
});
