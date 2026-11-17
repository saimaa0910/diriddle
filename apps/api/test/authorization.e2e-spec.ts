import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/database/prisma.service';

describe('Authorization Matrix & Access Control Suite (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let unverifiedUserToken: string;
  let verifiedUserTokenA: string;
  let verifiedUserIdA: string;
  let verifiedUserTokenB: string;
  let verifiedUserIdB: string;
  let testCommunityId: string;
  let userAPostId: string;
  let userAAttachmentId: string;

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

    // 1. Unverified User
    const phoneUnverified = '+919999900021';
    await request(app.getHttpServer())
      .post('/v1/auth/send-otp')
      .send({ identifier: phoneUnverified, type: 'phone' })
      .expect(200);
    const unverifiedRes = await request(app.getHttpServer())
      .post('/v1/auth/verify-otp')
      .send({ identifier: phoneUnverified, otp: '123456', type: 'phone' })
      .expect(200);
    unverifiedUserToken = unverifiedRes.body.access_token;

    // 2. Verified User A
    const phoneA = '+919999900022';
    await request(app.getHttpServer())
      .post('/v1/auth/send-otp')
      .send({ identifier: phoneA, type: 'phone' })
      .expect(200);
    const resA = await request(app.getHttpServer())
      .post('/v1/auth/verify-otp')
      .send({ identifier: phoneA, otp: '123456', type: 'phone' })
      .expect(200);
    verifiedUserTokenA = resA.body.access_token;
    verifiedUserIdA = resA.body.user.id;
    await request(app.getHttpServer())
      .post('/v1/auth/verify-age')
      .set('Authorization', `Bearer ${verifiedUserTokenA}`)
      .send({ confirmed_18_plus: true, accepted_terms: true, accepted_privacy: true })
      .expect(200);

    // 3. Verified User B
    const phoneB = '+919999900023';
    await request(app.getHttpServer())
      .post('/v1/auth/send-otp')
      .send({ identifier: phoneB, type: 'phone' })
      .expect(200);
    const resB = await request(app.getHttpServer())
      .post('/v1/auth/verify-otp')
      .send({ identifier: phoneB, otp: '123456', type: 'phone' })
      .expect(200);
    verifiedUserTokenB = resB.body.access_token;
    verifiedUserIdB = resB.body.user.id;
    await request(app.getHttpServer())
      .post('/v1/auth/verify-age')
      .set('Authorization', `Bearer ${verifiedUserTokenB}`)
      .send({ confirmed_18_plus: true, accepted_terms: true, accepted_privacy: true })
      .expect(200);

    // Create test community
    const comm = await prisma.community.create({
      data: {
        name: `Auth Matrix Comm ${Date.now()}`,
        slug: `auth-matrix-${Date.now()}`,
        type: 'CAMPUS',
        description: 'Authorization test community',
      },
    });
    testCommunityId = comm.id;

    // User A joins community
    await request(app.getHttpServer())
      .post(`/v1/communities/${testCommunityId}/join`)
      .set('Authorization', `Bearer ${verifiedUserTokenA}`)
      .expect(201);

    // User A creates post
    const postRes = await request(app.getHttpServer())
      .post('/v1/posts')
      .set('Authorization', `Bearer ${verifiedUserTokenA}`)
      .send({
        community_id: testCommunityId,
        category: 'STORY',
        content: 'Post owned by User A for authorization tests',
      })
      .expect(201);
    userAPostId = postRes.body.id;

    // User A creates attachment
    const attach = await prisma.attachment.create({
      data: {
        postId: userAPostId,
        type: 'IMAGE',
        url: '/v1/media/attachments/image/test-a.png',
        mimeType: 'image/png',
        sizeBytes: 1024,
        status: 'READY',
        scanStatus: 'CLEAN',
      },
    });
    userAAttachmentId = attach.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Age-Gate: unverified user is blocked from posting, commenting, reacting, and joining communities', async () => {
    // Attempt post
    const postRes = await request(app.getHttpServer())
      .post('/v1/posts')
      .set('Authorization', `Bearer ${unverifiedUserToken}`)
      .send({
        community_id: testCommunityId,
        category: 'STORY',
        content: 'Unverified post should be blocked',
      });
    expect(postRes.status).toBe(403);
    expect(postRes.body.error).toBe('AGE_VERIFICATION_REQUIRED');

    // Attempt comment
    const commentRes = await request(app.getHttpServer())
      .post(`/v1/posts/${userAPostId}/comments`)
      .set('Authorization', `Bearer ${unverifiedUserToken}`)
      .send({ content: 'Unverified comment should be blocked' });
    expect(commentRes.status).toBe(403);
    expect(commentRes.body.error).toBe('AGE_VERIFICATION_REQUIRED');

    // Attempt reaction
    const reactRes = await request(app.getHttpServer())
      .post(`/v1/posts/${userAPostId}/reactions`)
      .set('Authorization', `Bearer ${unverifiedUserToken}`)
      .send({ reaction_type: 'LIKE' });
    expect(reactRes.status).toBe(403);
    expect(reactRes.body.error).toBe('AGE_VERIFICATION_REQUIRED');

    // Attempt join community
    const joinRes = await request(app.getHttpServer())
      .post(`/v1/communities/${testCommunityId}/join`)
      .set('Authorization', `Bearer ${unverifiedUserToken}`);
    expect(joinRes.status).toBe(403);
    expect(joinRes.body.error).toBe('AGE_VERIFICATION_REQUIRED');
  });

  it('2. IDOR Prevention: User B cannot delete or modify User A post', async () => {
    // User B attempts to delete User A's post
    const delRes = await request(app.getHttpServer())
      .delete(`/v1/posts/${userAPostId}`)
      .set('Authorization', `Bearer ${verifiedUserTokenB}`);
    expect(delRes.status).toBe(403);
    expect(delRes.body.error).toBe('POST_DELETE_FORBIDDEN');

    // User B attempts to edit User A's post
    const editRes = await request(app.getHttpServer())
      .patch(`/v1/posts/${userAPostId}`)
      .set('Authorization', `Bearer ${verifiedUserTokenB}`)
      .send({ content: 'Tampered content by User B' });
    expect(editRes.status).toBe(403);
    expect(editRes.body.error).toBe('FORBIDDEN_EDIT');
  });

  it('3. IDOR Prevention: User B cannot delete User A attachment', async () => {
    const delAttachRes = await request(app.getHttpServer())
      .delete(`/v1/attachments/${userAAttachmentId}`)
      .set('Authorization', `Bearer ${verifiedUserTokenB}`);
    expect(delAttachRes.status).toBe(403);
    expect(delAttachRes.body.error).toBe('ATTACHMENT_DELETE_FORBIDDEN');
  });

  it('4. Community Staff Protection: regular member cannot pin or unpin posts', async () => {
    const pinRes = await request(app.getHttpServer())
      .post(`/v1/posts/${userAPostId}/pin`)
      .set('Authorization', `Bearer ${verifiedUserTokenB}`);
    expect(pinRes.status).toBe(403);
    expect(pinRes.body.error).toBe('FORBIDDEN_PIN');
  });

  it('5. Suspended User Access: suspended account cannot perform authenticated actions', async () => {
    // Suspend User B
    await prisma.user.update({
      where: { id: verifiedUserIdB },
      data: { status: 'SUSPENDED' },
    });

    const actionRes = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${verifiedUserTokenB}`);
    expect([401, 403]).toContain(actionRes.status);
  });
});
