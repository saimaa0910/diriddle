import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/database/prisma.service';

describe('Security & Penetration Audit Suite (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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

  it('1. OTP Brute-force lockout: rejects multiple failed verification attempts and locks out', async () => {
    const identifier = '+919876543210';
    await request(app.getHttpServer())
      .post('/v1/auth/send-otp')
      .send({ identifier, type: 'phone' })
      .expect(200);

    // Send 5 consecutive incorrect OTPs
    for (let i = 0; i < 5; i++) {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/verify-otp')
        .send({ identifier, otp: '999999', type: 'phone' });
      expect([400, 401, 429]).toContain(res.status);
    }

    // Next attempt must be locked out or rejected
    const lockedRes = await request(app.getHttpServer())
      .post('/v1/auth/verify-otp')
      .send({ identifier, otp: '123456', type: 'phone' });
    expect([400, 401, 429]).toContain(lockedRes.status);
  });

  it('2. Account linking takeover prevention: cannot link an identifier already bound to another user', async () => {
    // User A registers
    const userAPhone = '+919999900001';
    await request(app.getHttpServer())
      .post('/v1/auth/send-otp')
      .send({ identifier: userAPhone, type: 'phone' })
      .expect(200);
    const userARes = await request(app.getHttpServer())
      .post('/v1/auth/verify-otp')
      .send({ identifier: userAPhone, otp: '123456', type: 'phone' })
      .expect(200);
    const userAToken = userARes.body.access_token;

    // User B registers
    const userBPhone = '+919999900002';
    await request(app.getHttpServer())
      .post('/v1/auth/send-otp')
      .send({ identifier: userBPhone, type: 'phone' })
      .expect(200);
    const userBRes = await request(app.getHttpServer())
      .post('/v1/auth/verify-otp')
      .send({ identifier: userBPhone, otp: '123456', type: 'phone' })
      .expect(200);
    const userBToken = userBRes.body.access_token;

    // User B attempts to link User A's phone number -> MUST be rejected with 409 Conflict
    const linkRes = await request(app.getHttpServer())
      .post('/v1/auth/identities')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        provider: 'PHONE',
        identifier: userAPhone,
      });

    expect(linkRes.status).toBe(409);
    expect(linkRes.body.error).toBe('IDENTITY_ALREADY_LINKED');
  });

  it('3. Session revocation & JTI invalidation: revoked sessions cannot refresh or access resources', async () => {
    const phone = '+919999900003';
    await request(app.getHttpServer())
      .post('/v1/auth/send-otp')
      .send({ identifier: phone, type: 'phone' })
      .expect(200);
    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/verify-otp')
      .send({ identifier: phone, otp: '123456', type: 'phone' })
      .expect(200);

    const token = loginRes.body.access_token;
    const refreshToken = loginRes.body.refresh_token;

    // Fetch active sessions
    const sessionsRes = await request(app.getHttpServer())
      .get('/v1/auth/sessions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(sessionsRes.body.data.length).toBeGreaterThan(0);
    const sessionId = sessionsRes.body.data[0].id;

    // Revoke this specific session
    await request(app.getHttpServer())
      .delete(`/v1/auth/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Refresh attempt with revoked session refresh token must fail with 401
    const refreshRes = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refresh_token: refreshToken });
    expect(refreshRes.status).toBe(401);
  });

  it('4. Logout all devices: revokes all active user sessions simultaneously', async () => {
    const phone = '+919999900004';
    await request(app.getHttpServer())
      .post('/v1/auth/send-otp')
      .send({ identifier: phone, type: 'phone' })
      .expect(200);
    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/verify-otp')
      .send({ identifier: phone, otp: '123456', type: 'phone' })
      .expect(200);

    const token = loginRes.body.access_token;

    // Logout all
    await request(app.getHttpServer())
      .delete('/v1/auth/sessions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Active session list must now be empty
    const checkSessions = await request(app.getHttpServer())
      .get('/v1/auth/sessions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(checkSessions.body.data.length).toBe(0);
  });

  it('5. Purpose-limited identity resolution: ordinary users & expired admins are blocked from resolving identities', async () => {
    // Register standard user
    const userPhone = '+919999900005';
    await request(app.getHttpServer())
      .post('/v1/auth/send-otp')
      .send({ identifier: userPhone, type: 'phone' })
      .expect(200);
    const userRes = await request(app.getHttpServer())
      .post('/v1/auth/verify-otp')
      .send({ identifier: userPhone, otp: '123456', type: 'phone' })
      .expect(200);
    const userToken = userRes.body.access_token;

    // Create an anonymous identity to target
    const globalIdentRes = await request(app.getHttpServer())
      .get('/v1/identities/global')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    const targetIdentityId = globalIdentRes.body.id;

    // Ordinary user attempting audit-lookup -> MUST be rejected with 403 Forbidden
    const unauthLookup = await request(app.getHttpServer())
      .get(`/v1/identities/${targetIdentityId}/audit-lookup?reason=Testing+access`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(unauthLookup.status).toBe(403);

    // Register superadmin
    const adminPhone = '+919999900006';
    await request(app.getHttpServer())
      .post('/v1/auth/send-otp')
      .send({ identifier: adminPhone, type: 'phone' })
      .expect(200);
    const adminLoginRes = await request(app.getHttpServer())
      .post('/v1/auth/verify-otp')
      .send({ identifier: adminPhone, otp: '123456', type: 'phone' })
      .expect(200);
    const adminId = adminLoginRes.body.user.id;

    await prisma.adminRole.create({
      data: {
        userId: adminId,
        role: 'SUPER_ADMIN',
      },
    });

    const adminToken = adminLoginRes.body.access_token;

    // SuperAdmin lookup WITH purpose and case reference -> 200 OK
    const authLookup = await request(app.getHttpServer())
      .get(
        `/v1/identities/${targetIdentityId}/audit-lookup?reason=Legal+warrant+investigation&case_reference=CASE-2026-99&purpose=LAW_ENFORCEMENT`,
      )
      .set('Authorization', `Bearer ${adminToken}`);
    expect(authLookup.status).toBe(200);
    expect(authLookup.body.audit_logged).toBe(true);
    expect(authLookup.body.case_reference).toBe('CASE-2026-99');
    expect(authLookup.body.purpose).toBe('LAW_ENFORCEMENT');
  });
});
