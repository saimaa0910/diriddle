import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/database/prisma.service';

describe('Account Deletion, Grace Period & Recovery Suite (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
  let userId: string;
  let testCommunityId: string;

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

    // Register user
    const phone = '+919999900030';
    await request(app.getHttpServer())
      .post('/v1/auth/send-otp')
      .send({ identifier: phone, type: 'phone' })
      .expect(200);

    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/verify-otp')
      .send({ identifier: phone, otp: '123456', type: 'phone' })
      .expect(200);

    userToken = loginRes.body.access_token;
    userId = loginRes.body.user.id;

    // Verify age
    await request(app.getHttpServer())
      .post('/v1/auth/verify-age')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ confirmed_18_plus: true, accepted_terms: true, accepted_privacy: true })
      .expect(200);

    const comm = await prisma.community.create({
      data: {
        name: `Deletion Comm ${Date.now()}`,
        slug: `del-comm-${Date.now()}`,
        type: 'CAMPUS',
        description: 'Community for deletion tests',
      },
    });
    testCommunityId = comm.id;

    await request(app.getHttpServer())
      .post(`/v1/communities/${testCommunityId}/join`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Request Deletion initiates 30-day grace recovery window', async () => {
    const reqDelRes = await request(app.getHttpServer())
      .post('/v1/users/me/request-deletion')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ reason: 'Privacy preference' })
      .expect(201);

    expect(reqDelRes.body.status).toBe('DELETION_PENDING');
    expect(reqDelRes.body.scheduled_deletion_at).toBeDefined();
    expect(reqDelRes.body.recovery_days).toBe(30);

    // Check deletion status endpoint
    const statusRes = await request(app.getHttpServer())
      .get('/v1/users/me/deletion-status')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(statusRes.body.has_pending_deletion).toBe(true);
    expect(statusRes.body.deletion.status).toBe('PENDING');
  });

  it('2. Cancel Deletion restores account to ACTIVE status during grace window', async () => {
    const cancelRes = await request(app.getHttpServer())
      .post('/v1/users/me/cancel-deletion')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(201);

    expect(cancelRes.body.status).toBe('ACTIVE');
    expect(cancelRes.body.cancellation_successful).toBe(true);

    // Verify deletion status endpoint confirms no pending deletion
    const statusRes = await request(app.getHttpServer())
      .get('/v1/users/me/deletion-status')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(statusRes.body.has_pending_deletion).toBe(false);
  });

  it('3. Irreversible Account Deletion scrubs user PII, revokes tokens, and anonymizes content', async () => {
    // Create post and comment before final deletion
    const postRes = await request(app.getHttpServer())
      .post('/v1/posts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        community_id: testCommunityId,
        category: 'STORY',
        content: 'Content to be anonymized and removed',
      })
      .expect(201);
    const postId = postRes.body.id;

    const commentRes = await request(app.getHttpServer())
      .post(`/v1/posts/${postId}/comments`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'Comment to be removed' })
      .expect(201);
    const commentId = commentRes.body.id;

    // Execute direct irreversible account deletion
    const deleteRes = await request(app.getHttpServer())
      .delete('/v1/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ reason: 'Permanently leaving platform' })
      .expect(200);

    expect(deleteRes.body.deleted).toBe(true);
    expect(deleteRes.body.deleted_at).toBeDefined();

    // Verify post status is marked REMOVED and deletedAt is set
    const postInDb = await prisma.post.findUnique({ where: { id: postId } });
    expect(postInDb?.status).toBe('REMOVED');
    expect(postInDb?.deletedAt).not.toBeNull();

    // Verify comment status is marked REMOVED and deletedAt is set
    const commentInDb = await prisma.comment.findUnique({ where: { id: commentId } });
    expect(commentInDb?.status).toBe('REMOVED');
    expect(commentInDb?.deletedAt).not.toBeNull();

    // Verify user record status is DELETED and authId is anonymized
    const userInDb = await prisma.user.findUnique({ where: { id: userId } });
    expect(userInDb?.status).toBe('DELETED');
    expect(userInDb?.deletedAt).not.toBeNull();
    expect(userInDb?.authId).toMatch(/^deleted:/);

    // Verify AuditLog captures the deletion event
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        actorId: userId,
        action: 'USER_ACCOUNT_DELETED',
      },
    });
    expect(auditLogs.length).toBeGreaterThan(0);
  });
});
