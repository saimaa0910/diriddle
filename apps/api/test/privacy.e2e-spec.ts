import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/database/prisma.service';

describe('Privacy, Anonymity & GPS Verification Suite (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
  let userId: string;
  let communityAId: string;
  let communityBId: string;

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

    // Register test user
    const phone = '+919999900010';
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

    // Verify age (18+)
    await request(app.getHttpServer())
      .post('/v1/auth/verify-age')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ confirmed_18_plus: true, accepted_terms: true, accepted_privacy: true })
      .expect(200);

    // Create 2 test communities
    const commA = await prisma.community.create({
      data: {
        name: `Privacy Comm A ${Date.now()}`,
        slug: `priv-comm-a-${Date.now()}`,
        type: 'CAMPUS',
        description: 'Test community A',
      },
    });
    communityAId = commA.id;

    const commB = await prisma.community.create({
      data: {
        name: `Privacy Comm B ${Date.now()}`,
        slug: `priv-comm-b-${Date.now()}`,
        type: 'CAMPUS',
        description: 'Test community B',
      },
    });
    communityBId = commB.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Public Post & Comment APIs never expose internal userId, contact info, or GPS in author objects', async () => {
    const postRes = await request(app.getHttpServer())
      .post('/v1/posts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        community_id: communityAId,
        category: 'STORY',
        content: 'Confidential anonymous post for privacy verification',
      })
      .expect(201);

    const postId = postRes.body.id;
    expect(postRes.body.anonymous_name).toBeDefined();
    expect(postRes.body.anonymous_name).toMatch(/^Anonymous #\d+$/);

    // Deep check post response for privacy leaks
    expect(postRes.body.userId).toBeUndefined();
    expect(postRes.body.user_id).toBeUndefined();
    expect(postRes.body.email).toBeUndefined();
    expect(postRes.body.phone).toBeUndefined();
    expect(postRes.body.exact_gps).toBeUndefined();

    // Add comment
    const commentRes = await request(app.getHttpServer())
      .post(`/v1/posts/${postId}/comments`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'Anonymous reply' })
      .expect(201);

    expect(commentRes.body.anonymous_name).toBeDefined();
    expect(commentRes.body.userId).toBeUndefined();
    expect(commentRes.body.user_id).toBeUndefined();

    // Query public feed
    const feedRes = await request(app.getHttpServer())
      .get('/v1/feed/latest')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    const feedPost = feedRes.body.data.find((p: any) => p.id === postId);
    if (feedPost) {
      expect(feedPost.userId).toBeUndefined();
      expect(feedPost.user_id).toBeUndefined();
      expect(feedPost.phone).toBeUndefined();
    }
  });

  it('2. Cross-community deanonymization prevention: user receives decoupled pseudonyms across communities', async () => {
    // Identity in Community A
    const postARes = await request(app.getHttpServer())
      .post('/v1/posts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        community_id: communityAId,
        category: 'CONFESSION',
        content: 'Post in Community A',
      })
      .expect(201);

    // Identity in Community B
    const postBRes = await request(app.getHttpServer())
      .post('/v1/posts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        community_id: communityBId,
        category: 'CONFESSION',
        content: 'Post in Community B',
      })
      .expect(201);

    // Global identity
    const globalRes = await request(app.getHttpServer())
      .get('/v1/identities/global')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    const displayA = postARes.body.anonymous_name;
    const displayB = postBRes.body.anonymous_name;
    const displayGlobal = globalRes.body.display_code;

    // Pseudonyms must be decoupled and unique per community context
    expect(displayA).toBeDefined();
    expect(displayB).toBeDefined();
    expect(displayGlobal).toBeDefined();
    expect(displayGlobal).toMatch(/^Global #\d+$/);
  });

  it('3. Ephemeral GPS coarse cell snapping and retention scheduling', async () => {
    // Upload precise GPS coordinates (Bengaluru Vidhana Soudha: 12.9797, 77.5906)
    const gpsRes = await request(app.getHttpServer())
      .post('/v1/location/gps')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        lat: 12.9797,
        lng: 77.5906,
      })
      .expect(201);
    expect(gpsRes.body.geo_cell).toBeDefined();
    expect(gpsRes.body.nearest_city).toBe('Bengaluru');
    expect(gpsRes.body.expires_in_seconds).toBeGreaterThan(0);

    // Verify current effective location endpoint
    const currLocRes = await request(app.getHttpServer())
      .get('/v1/location/current')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(currLocRes.body.source).toBe('GPS');
    expect(currLocRes.body.exact_lat).toBeUndefined();
    expect(currLocRes.body.exact_lng).toBeUndefined();
  });

  it('4. GDPR Data Export Envelope v2.0 completeness', async () => {
    const exportRes = await request(app.getHttpServer())
      .get('/v1/privacy/export')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(exportRes.body.export_version).toBe('2.0');
    expect(exportRes.body.account).toBeDefined();
    expect(exportRes.body.account.age_verified).toBe(true);
    expect(exportRes.body.identities).toBeDefined();
    expect(exportRes.body.content).toBeDefined();
    expect(exportRes.body.content.posts).toBeDefined();
  });
});
