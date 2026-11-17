import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../database/prisma.service';
import { InMemoryPrismaStore } from '../database/in-memory-prisma';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let store: InMemoryPrismaStore;

  beforeEach(async () => {
    store = new InMemoryPrismaStore();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: store },
      ],
    }).compile();

    service = module.get(AnalyticsService);
  });

  describe('getPlatformMetrics', () => {
    it('returns platform KPIs and city breakdown', async () => {
      const now = new Date();
      // Seed users
      await store.user.create({
        data: { authId: 'phone:+919999900001', status: 'ACTIVE' },
      });
      await store.user.create({
        data: { authId: 'phone:+919999900002', status: 'ACTIVE' },
      });

      // Seed a post
      const user = await store.user.findFirst();
      await store.post.create({
        data: {
          userId: user!.id,
          communityId: 'comm-bengaluru',
          content: 'Hello Bengaluru!',
          category: 'GENERAL',
          status: 'PUBLISHED',
          createdAt: now,
          isDraft: false,
          isPinned: false,
        },
      });

      // Seed a resolved report to test avg resolution minutes
      const report = await store.report.create({
        data: {
          reporterId: user!.id,
          targetType: 'POST',
          targetId: 'post-1',
          reason: 'SPAM',
          status: 'RESOLVED',
          createdAt: new Date(now.getTime() - 10 * 60 * 1000), // 10 minutes ago
          resolvedAt: now,
        },
      });

      const metrics = await service.getPlatformMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.total_users).toBeGreaterThanOrEqual(2);
      expect(metrics.active_users).toBeGreaterThanOrEqual(2);
      expect(metrics.total_posts).toBeGreaterThanOrEqual(1);
      expect(metrics.posts_24h).toBeGreaterThanOrEqual(1);
      expect(metrics.avg_moderation_response_minutes).toBe(10);
      expect(Array.isArray(metrics.city_breakdown)).toBe(true);
      expect(metrics.city_breakdown.length).toBeGreaterThan(0);
      expect(Array.isArray(metrics.top_communities)).toBe(true);
    });

    it('handles zero resolved reports gracefully without dividing by zero', async () => {
      const metrics = await service.getPlatformMetrics();
      expect(metrics.avg_moderation_response_minutes).toBe(0);
    });
  });

  describe('getCommunityGrowth', () => {
    it('returns null when community does not exist', async () => {
      const result = await service.getCommunityGrowth('non-existent-comm');
      expect(result).toBeNull();
    });

    it('returns community growth metrics when community exists', async () => {
      const result = await service.getCommunityGrowth('comm-bengaluru');
      expect(result).toBeDefined();
      expect(result!.community_id).toBe('comm-bengaluru');
      expect(result!.name).toBe('Bengaluru');
      expect(result!.growth).toHaveLength(2);
      expect(result!.growth[0].period).toBe('last_7d');
      expect(result!.growth[1].period).toBe('last_30d');
    });
  });
});
