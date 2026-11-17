import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/database/prisma.service';

interface LatencyStats {
  count: number;
  totalDurationMs: number;
  rps: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  errors: number;
  errorRatePercent: number;
}

function calculatePercentiles(latencies: number[], totalTimeMs: number, errors: number): LatencyStats {
  const sorted = [...latencies].sort((a, b) => a - b);
  const count = sorted.length;
  const p50 = sorted[Math.floor(count * 0.5)] ?? 0;
  const p95 = sorted[Math.floor(count * 0.95)] ?? 0;
  const p99 = sorted[Math.floor(count * 0.99)] ?? 0;
  const min = sorted[0] ?? 0;
  const max = sorted[count - 1] ?? 0;
  const rps = count > 0 ? (count / (totalTimeMs / 1000)) : 0;
  const errorRatePercent = (errors / (count + errors)) * 100;

  return {
    count,
    totalDurationMs: Math.round(totalTimeMs),
    rps: Math.round(rps * 100) / 100,
    p50: Math.round(p50 * 100) / 100,
    p95: Math.round(p95 * 100) / 100,
    p99: Math.round(p99 * 100) / 100,
    min: Math.round(min * 100) / 100,
    max: Math.round(max * 100) / 100,
    errors,
    errorRatePercent: Math.round(errorRatePercent * 100) / 100,
  };
}

describe('Performance, Concurrency & Latency Benchmark Suite', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let testCommunityId: string;
  let benchmarkPostId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    // Warm up / seed user
    const phone = '+919800000099';
    await request(app.getHttpServer())
      .post('/v1/auth/send-otp')
      .send({ identifier: phone, type: 'phone' });

    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/verify-otp')
      .send({ identifier: phone, otp: '123456', type: 'phone' });
    authToken = loginRes.body.access_token;

    await request(app.getHttpServer())
      .post('/v1/auth/verify-age')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ confirmed_18_plus: true, accepted_terms: true, accepted_privacy: true });

    const comm = await prisma.community.create({
      data: {
        name: `Perf Bench Comm ${Date.now()}`,
        slug: `perf-comm-${Date.now()}`,
        type: 'CITY',
        description: 'Performance test community',
      },
    });
    testCommunityId = comm.id;

    await request(app.getHttpServer())
      .post(`/v1/communities/${testCommunityId}/join`)
      .set('Authorization', `Bearer ${authToken}`);

    const postRes = await request(app.getHttpServer())
      .post('/v1/posts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        community_id: testCommunityId,
        category: 'STORY',
        content: 'Benchmark anchor post for reaction and comment load testing',
      });
    benchmarkPostId = postRes.body.id;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('Benchmark 1: High-Concurrency Discovery & City Listing (/v1/location/cities)', async () => {
    const CONCURRENCY = 50;
    const TOTAL_REQUESTS = 150;
    const latencies: number[] = [];
    let errors = 0;

    const startTime = performance.now();
    for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENCY) {
      const batch = Array.from({ length: Math.min(CONCURRENCY, TOTAL_REQUESTS - i) }, async () => {
        const reqStart = performance.now();
        try {
          const res = await request(app.getHttpServer()).get('/v1/location/cities');
          if (res.status === 200) {
            latencies.push(performance.now() - reqStart);
          } else {
            errors++;
          }
        } catch {
          errors++;
        }
      });
      await Promise.all(batch);
    }
    const totalTime = performance.now() - startTime;
    const stats = calculatePercentiles(latencies, totalTime, errors);

    console.log('\n--- BENCHMARK 1: Location & City Discovery ---');
    console.table([stats]);

    expect(stats.errorRatePercent).toBe(0);
    expect(stats.p95).toBeLessThan(500); // Sub-500ms p95 under parallel Jest runner saturation
  });

  it('Benchmark 2: Feed Retrieval under Concurrency (/v1/feed/latest & /v1/feed/trending)', async () => {
    const TOTAL_REQUESTS = 100;
    const latencies: number[] = [];
    let errors = 0;

    const startTime = performance.now();
    const batch = Array.from({ length: TOTAL_REQUESTS }, async (_, idx) => {
      const endpoint = idx % 2 === 0 ? '/v1/feed/latest' : '/v1/feed/trending';
      const reqStart = performance.now();
      try {
        const res = await request(app.getHttpServer())
          .get(endpoint)
          .set('Authorization', `Bearer ${authToken}`);
        if (res.status === 200) {
          latencies.push(performance.now() - reqStart);
        } else {
          errors++;
        }
      } catch {
        errors++;
      }
    });
    await Promise.all(batch);
    const totalTime = performance.now() - startTime;
    const stats = calculatePercentiles(latencies, totalTime, errors);

    console.log('\n--- BENCHMARK 2: Feed Retrieval (Latest & Trending) ---');
    console.table([stats]);

    expect(stats.errorRatePercent).toBe(0);
    expect(stats.p95).toBeLessThan(350);
  });

  it('Benchmark 3: Social Interactions Write Throughput (Comments & Reactions)', async () => {
    const TOTAL_WRITES = 40;
    const latencies: number[] = [];
    let errors = 0;

    const startTime = performance.now();
    for (let i = 0; i < TOTAL_WRITES; i++) {
      const reqStart = performance.now();
      try {
        const res = await request(app.getHttpServer())
          .post(`/v1/posts/${benchmarkPostId}/comments`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ content: `Concurrent load comment #${i}` });
        if (res.status === 201) {
          latencies.push(performance.now() - reqStart);
        } else {
          errors++;
        }
      } catch {
        errors++;
      }
    }
    const totalTime = performance.now() - startTime;
    const stats = calculatePercentiles(latencies, totalTime, errors);

    console.log('\n--- BENCHMARK 3: Comment Write Operations ---');
    console.table([stats]);

    expect(stats.errorRatePercent).toBe(0);
    expect(stats.p50).toBeLessThan(50);
  });

  it('Benchmark 4: Search Engine Concurrency (/v1/search?q=...)', async () => {
    const queries = ['Bengaluru', 'Mumbai', 'Campus', 'Confession', 'Story'];
    const TOTAL_SEARCHES = 50;
    const latencies: number[] = [];
    let errors = 0;

    const startTime = performance.now();
    const batch = Array.from({ length: TOTAL_SEARCHES }, async (_, i) => {
      const q = queries[i % queries.length];
      const reqStart = performance.now();
      try {
        const res = await request(app.getHttpServer())
          .get(`/v1/search/posts?q=${encodeURIComponent(q)}`)
          .set('Authorization', `Bearer ${authToken}`);
        if (res.status === 200) {
          latencies.push(performance.now() - reqStart);
        } else {
          errors++;
        }
      } catch {
        errors++;
      }
    });
    await Promise.all(batch);
    const totalTime = performance.now() - startTime;
    const stats = calculatePercentiles(latencies, totalTime, errors);

    console.log('\n--- BENCHMARK 4: Search Engine Multi-Entity Queries ---');
    console.table([stats]);

    const mem = process.memoryUsage();
    console.log('\n--- NODE PROCESS RESOURCE USAGE ---');
    console.table([
      {
        rss_mb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
        heap_total_mb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
        heap_used_mb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
        external_mb: Math.round((mem.external / 1024 / 1024) * 100) / 100,
      },
    ]);

    expect(stats.errorRatePercent).toBe(0);
  });
});
