import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/database/prisma.service';

describe('diriddle API (e2e, DEV_IN_MEMORY=true)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
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
    prisma = app.get(PrismaService);
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

  it('1. Age-Gate Enforcing: unverified user posting returns 403 AGE_VERIFICATION_REQUIRED', async () => {
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

    const meRes = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(meRes.body.age_verified).toBe(false);

    const unverifiedPost = await request(app.getHttpServer())
      .post('/v1/posts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        community_id: 'comm-bengaluru',
        category: 'CONFESSION',
        content: 'This post should be rejected before age verification.',
        visibility: 'COMMUNITY',
      })
      .expect(403);

    expect(unverifiedPost.body.error).toBe('AGE_VERIFICATION_REQUIRED');
  });

  it('2. Age-Verification: user calls /v1/auth/verify-age and succeeds', async () => {
    const verifyAgeRes = await request(app.getHttpServer())
      .post('/v1/auth/verify-age')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ confirmed_18_plus: true, accepted_terms: true, accepted_privacy: true })
      .expect(200);

    expect(verifyAgeRes.body.age_verified).toBe(true);

    const meRes = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(meRes.body.age_verified).toBe(true);
  });

  it('3 & 4. Verified Posting & Anonymous Identity Generation: returns 201 and Anonymous #XXXX', async () => {
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
    expect(createdPostId).toBeTruthy();
    expect(postRes.body.anonymous_name).toMatch(/^Anonymous #\d{4}$/);
    expect(postRes.body.content).toBe('Indiranagar 100ft road evening walk is underrated.');
  });

  it('5. Commenting: add comment to post returns 201', async () => {
    const commentRes = await request(app.getHttpServer())
      .post(`/v1/posts/${createdPostId}/comments`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'Totally agree!' })
      .expect(201);

    createdCommentId = commentRes.body.id;
    expect(createdCommentId).toBeTruthy();
    expect(commentRes.body.anonymous_name).toMatch(/^Anonymous #\d{4}$/);

    await request(app.getHttpServer())
      .post(`/v1/comments/${createdCommentId}/replies`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'Especially around 7 PM.' })
      .expect(201);
  });

  it('6. Reaction: react to post returns 201/200 with updated counts', async () => {
    const reactRes = await request(app.getHttpServer())
      .post(`/v1/posts/${createdPostId}/reactions`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ reaction_type: 'HEART' });

    expect([200, 201]).toContain(reactRes.status);
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

  it('7 & 8. Block By Content and Self-Block Prevention', async () => {
    // 8. Self-Block Prevention: Blocker blocking own post -> 400 SELF_BLOCK_FORBIDDEN
    const selfBlockRes = await request(app.getHttpServer())
      .post('/v1/blocks/by-content')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        target_type: 'POST',
        target_id: createdPostId,
        reason: 'Attempting self-block',
      })
      .expect(400);

    expect(selfBlockRes.body.error).toBe('SELF_BLOCK_FORBIDDEN');
    expect(selfBlockRes.body.requestId).toBeTruthy();

    // Also verify legacy self-block prevention on /v1/blocks with user_id
    const blockSelfLegacy = await request(app.getHttpServer())
      .post('/v1/blocks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ user_id: userId })
      .expect(400);
    expect(blockSelfLegacy.body.error).toBe('SELF_BLOCK_NOT_ALLOWED');

    // 7. Block By Content: User blocks author of post-demo-2 -> 200/201 without exposing userId
    const blockContentRes = await request(app.getHttpServer())
      .post('/v1/blocks/by-content')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        target_type: 'POST',
        target_id: 'post-demo-2',
        reason: 'Content block test',
      });

    expect([200, 201]).toContain(blockContentRes.status);
    expect(blockContentRes.body.success).toBe(true);
    expect(blockContentRes.body.userId).toBeUndefined();
    expect(blockContentRes.body.author_user_id).toBeUndefined();
    expect(blockContentRes.body.blockedId).toBeUndefined();

    // Safety report submission
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

  it('9. Admin Role Expiration: expired admin token accessing /v1/admin/overview -> 403 ADMIN_ROLE_EXPIRED', async () => {
    const expiredPhone = '+919800000099';
    const pastDate = new Date(Date.now() - 3600000);

    // Authenticate user to obtain valid JWT
    await request(app.getHttpServer())
      .post('/v1/auth/send-otp')
      .send({ identifier: expiredPhone, type: 'phone' })
      .expect(200);

    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/verify-otp')
      .send({ identifier: expiredPhone, otp: '123456', type: 'phone' })
      .expect(200);

    const expiredToken = loginRes.body.access_token;
    const expiredUserId = loginRes.body.user.id;

    // Attach expired MODERATOR role
    await prisma.adminRole.create({
      data: {
        userId: expiredUserId,
        role: 'MODERATOR',
        scope: 'PLATFORM',
        scopeId: null,
        expiresAt: pastDate,
      },
    });

    // Access /v1/admin/overview with the expired admin token
    const res = await request(app.getHttpServer())
      .get('/v1/admin/overview')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(403);

    expect(res.body.error).toBe('ADMIN_ROLE_EXPIRED');
    expect(res.body.statusCode).toBe(403);
  });

  it('enforces admin RBAC and allows seeded SUPER_ADMIN access', async () => {
    // Non-admin user receives 403 FORBIDDEN_ADMIN_ROLE
    const forbidden = await request(app.getHttpServer())
      .get('/v1/admin/overview')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
    expect(forbidden.body.error).toBe('FORBIDDEN_ADMIN_ROLE');

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

  it('10. Account Deletion Scrubbing: delete account -> posts and comments marked REMOVED', async () => {
    const scrubPhone = '+919800000055';
    await request(app.getHttpServer())
      .post('/v1/auth/send-otp')
      .send({ identifier: scrubPhone, type: 'phone' })
      .expect(200);

    const scrubLogin = await request(app.getHttpServer())
      .post('/v1/auth/verify-otp')
      .send({ identifier: scrubPhone, otp: '123456', type: 'phone' })
      .expect(200);

    const scrubToken = scrubLogin.body.access_token;
    const scrubUserId = scrubLogin.body.user.id;

    await request(app.getHttpServer())
      .post('/v1/auth/verify-age')
      .set('Authorization', `Bearer ${scrubToken}`)
      .send({ confirmed_18_plus: true, accepted_terms: true, accepted_privacy: true })
      .expect(200);

    await request(app.getHttpServer())
      .post('/v1/communities/comm-bengaluru/join')
      .set('Authorization', `Bearer ${scrubToken}`)
      .expect(201);

    const postRes = await request(app.getHttpServer())
      .post('/v1/posts')
      .set('Authorization', `Bearer ${scrubToken}`)
      .send({
        community_id: 'comm-bengaluru',
        category: 'RANT',
        content: 'Post to be removed upon account deletion.',
        visibility: 'COMMUNITY',
      })
      .expect(201);
    const scrubPostId = postRes.body.id;

    const commentRes = await request(app.getHttpServer())
      .post(`/v1/posts/${scrubPostId}/comments`)
      .set('Authorization', `Bearer ${scrubToken}`)
      .send({ content: 'Comment to be removed upon account deletion.' })
      .expect(201);
    const scrubCommentId = commentRes.body.id;

    // Delete account
    const deleteRes = await request(app.getHttpServer())
      .delete('/v1/users/me')
      .set('Authorization', `Bearer ${scrubToken}`)
      .send({ reason: 'Privacy request' });
    expect([200, 204]).toContain(deleteRes.status);

    // Verify post and comment status in database are REMOVED
    const postInDb = await prisma.post.findUnique({ where: { id: scrubPostId } });
    expect(postInDb).toBeTruthy();
    expect(postInDb!.status).toBe('REMOVED');
    expect(postInDb!.deletedAt).toBeTruthy();

    const commentInDb = await prisma.comment.findUnique({ where: { id: scrubCommentId } });
    expect(commentInDb).toBeTruthy();
    expect(commentInDb!.status).toBe('REMOVED');
    expect(commentInDb!.deletedAt).toBeTruthy();

    // Verify deleted user token is now rejected
    await request(app.getHttpServer())
      .get('/v1/users/me')
      .set('Authorization', `Bearer ${scrubToken}`)
      .expect(401);
  });
});
