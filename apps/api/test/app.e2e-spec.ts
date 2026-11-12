import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('diriddle API (e2e, DEV_IN_MEMORY=true)', () => {
  let app: INestApplication;
  let userToken: string;
  let userId: string;
  let adminToken: string;
  let createdPostId: string;
  let createdCommentId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/health returns ok in in-memory mode', async () => {
    const res = await request(app.getHttpServer()).get('/v1/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.mode).toBe('in-memory');
  });

  it('GET /v1/location/cities returns 10 Indian cities', async () => {
    const res = await request(app.getHttpServer()).get('/v1/location/cities').expect(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(10);
    expect(res.body.data.map((c: any) => c.name)).toContain('Bengaluru');
  });

  it('authenticates user via OTP 123456 and verifies 18+ eligibility', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/send-otp')
      .send({ identifier: '+919800000001', type: 'phone' })
      .expect(200);

    const verifyRes = await request(app.getHttpServer())
      .post('/v1/auth/verify-otp')
      .send({ identifier: '+919800000001', otp: '123456', type: 'phone' })
      .expect(200);

    userToken = verifyRes.body.access_token;
    userId = verifyRes.body.user.id;
    expect(userToken).toBeTruthy();

    await request(app.getHttpServer())
      .post('/v1/auth/verify-age')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ confirmed_18_plus: true, accepted_terms: true, accepted_privacy: true })
      .expect(200);

    const meRes = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(meRes.body.age_verified).toBe(true);
  });

  it('lists communities, joins Bengaluru, creates post, comments, reacts, and saves', async () => {
    const commRes = await request(app.getHttpServer())
      .get('/v1/communities?city=Bengaluru')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(commRes.body.data.length).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .post('/v1/communities/comm-bengaluru/join')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(201);

    const postRes = await request(app.getHttpServer())
      .post('/v1/posts')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', 'e2e-post-1')
      .send({
        community_id: 'comm-bengaluru',
        category: 'CONFESSION',
        content: 'Indiranagar 100ft road evening walk is underrated.',
        visibility: 'COMMUNITY',
      })
      .expect(201);

    createdPostId = postRes.body.id;
    expect(postRes.body.anonymous_name).toMatch(/^Anonymous #\d{4}$/);

    const commentRes = await request(app.getHttpServer())
      .post(`/v1/posts/${createdPostId}/comments`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'Totally agree!' })
      .expect(201);
    createdCommentId = commentRes.body.id;

    await request(app.getHttpServer())
      .post(`/v1/comments/${createdCommentId}/replies`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'Especially around 7 PM.' })
      .expect(201);

    const reactRes = await request(app.getHttpServer())
      .post(`/v1/posts/${createdPostId}/reactions`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ reaction_type: 'HEART' })
      .expect(201);
    expect(reactRes.body.reaction_counts.HEART).toBe(1);

    await request(app.getHttpServer())
      .post(`/v1/posts/${createdPostId}/save`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(201);
  });

  it('serves nearby, latest, trending, and category feeds', async () => {
    const latest = await request(app.getHttpServer())
      .get('/v1/feed/latest')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(latest.body.data.some((p: any) => p.id === createdPostId)).toBe(true);

    const nearby = await request(app.getHttpServer())
      .get('/v1/feed/nearby?city=Bengaluru')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(nearby.body.data.length).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .get('/v1/feed/trending')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/v1/feed/category/CONFESSION')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
  });

  it('enforces self-block error envelope and supports safety reports', async () => {
    const blockSelf = await request(app.getHttpServer())
      .post('/v1/blocks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ user_id: userId })
      .expect(400);
    expect(blockSelf.body.error).toBe('SELF_BLOCK_NOT_ALLOWED');
    expect(blockSelf.body.requestId).toBeTruthy();

    const reportRes = await request(app.getHttpServer())
      .post('/v1/reports')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        target_type: 'POST',
        target_id: 'post-demo-2',
        reason: 'SPAM',
        description: 'Testing report workflow',
      })
      .expect(201);
    expect(reportRes.body.status).toBe('RECEIVED');

    const myReports = await request(app.getHttpServer())
      .get('/v1/reports/me')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(myReports.body.data.length).toBe(1);
  });

  it('enforces admin RBAC and allows seeded SUPER_ADMIN access', async () => {
    await request(app.getHttpServer())
      .get('/v1/admin/overview')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/v1/auth/send-otp')
      .send({ identifier: '+919876543210', type: 'phone' })
      .expect(200);

    const adminLogin = await request(app.getHttpServer())
      .post('/v1/auth/verify-otp')
      .send({ identifier: '+919876543210', otp: '123456', type: 'phone' })
      .expect(200);
    adminToken = adminLogin.body.access_token;

    const overview = await request(app.getHttpServer())
      .get('/v1/admin/overview')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(overview.body.kpis.active_cities).toBeGreaterThanOrEqual(10);

    const analytics = await request(app.getHttpServer())
      .get('/v1/admin/analytics')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(analytics.body.total_posts).toBeGreaterThan(0);
  });
});
