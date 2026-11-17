import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthProvider } from '@prisma/client';
import { AuthService } from './auth.service';
import { OtpRateLimiterService } from './otp-rate-limiter.service';
import { OtpStorageService } from './otp-storage.service';
import { SessionService } from './session.service';
import { TokenRevocationService } from './token-revocation.service';
import { PrismaService } from '../database/prisma.service';
import { InMemoryPrismaStore } from '../database/in-memory-prisma';

describe('AuthService', () => {
  let service: AuthService;
  let sessionService: SessionService;
  let store: InMemoryPrismaStore;
  let rateLimiter: OtpRateLimiterService;
  let revocationService: TokenRevocationService;

  beforeEach(async () => {
    process.env.ALLOW_DEV_OTP = 'true';
    process.env.NODE_ENV = 'test';
    store = new InMemoryPrismaStore();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        OtpRateLimiterService,
        OtpStorageService,
        SessionService,
        TokenRevocationService,
        JwtService,
        {
          provide: ConfigService,
          useValue: {
            get: (_key: string, fallback?: string) => fallback ?? 'test-secret',
          },
        },
        {
          provide: PrismaService,
          useValue: store,
        },
      ],
    }).compile();

    service = module.get(AuthService);
    sessionService = module.get(SessionService);
    rateLimiter = module.get(OtpRateLimiterService);
    revocationService = module.get(TokenRevocationService);
  });

  afterEach(() => {
    rateLimiter.clear();
  });

  it('sends and verifies dev OTP 123456 and returns JWT tokens', async () => {
    const sendRes = await service.sendOtp({ identifier: '+919900112233', type: 'phone' });
    expect(sendRes.expires_in).toBe(600);

    const verifyRes = await service.verifyOtp({
      identifier: '+919900112233',
      otp: '123456',
      type: 'phone',
    });

    expect(verifyRes.access_token).toBeTruthy();
    expect(verifyRes.refresh_token).toBeTruthy();
    expect(verifyRes.user.age_verified).toBe(false);
  });

  it('rejects invalid OTP', async () => {
    await service.sendOtp({ identifier: 'user@example.com', type: 'email' });
    await expect(
      service.verifyOtp({ identifier: 'user@example.com', otp: '999999', type: 'email' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('refreshes tokens and revokes old refresh token on rotation', async () => {
    await service.sendOtp({ identifier: '+919900112244', type: 'phone' });
    const login = await service.verifyOtp({
      identifier: '+919900112244',
      otp: '123456',
      type: 'phone',
    });

    const refreshed = await service.refresh({ refresh_token: login.refresh_token });
    expect(refreshed.access_token).toBeTruthy();
    expect(refreshed.refresh_token).toBeTruthy();

    await expect(
      service.refresh({ refresh_token: login.refresh_token }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('verifies 18+ age eligibility and rejects under-18 attempts', async () => {
    await service.sendOtp({ identifier: '+919900112255', type: 'phone' });
    const login = await service.verifyOtp({
      identifier: '+919900112255',
      otp: '123456',
      type: 'phone',
    });

    await expect(
      service.verifyAge(login.user.id, {
        confirmed_18_plus: false,
        accepted_terms: true,
        accepted_privacy: true,
      }),
    ).rejects.toThrow(BadRequestException);

    const ok = await service.verifyAge(login.user.id, {
      confirmed_18_plus: true,
      accepted_terms: true,
      accepted_privacy: true,
    });
    expect(ok.age_verified).toBe(true);
  });

  it('verifies age via mobile shorthand payload { confirmed: true }', async () => {
    await service.sendOtp({ identifier: '+919900112266', type: 'phone' });
    const login = await service.verifyOtp({
      identifier: '+919900112266',
      otp: '123456',
      type: 'phone',
    });

    const ok = await service.verifyAge(login.user.id, {
      confirmed: true,
    });
    expect(ok.age_verified).toBe(true);
  });

  it('revokes token via TokenRevocationService and checks expiry', () => {
    const jti = 'test-jti-123';
    expect(revocationService.isRevoked(jti)).toBe(false);

    revocationService.revoke(jti, Date.now() + 10000);
    expect(revocationService.isRevoked(jti)).toBe(true);

    // Expired entry
    revocationService.revoke('expired-jti', Date.now() - 1000);
    expect(revocationService.isRevoked('expired-jti')).toBe(false);
  });

  it('links and unlinks authentication identities safely', async () => {
    const user = await store.user.create({ data: { authId: 'phone:+919988776655' } });

    // Link Google identity
    const link1 = await service.linkIdentity(user.id, {
      provider: AuthProvider.GOOGLE,
      identifier: 'google-sub-12345',
    });
    expect(link1.linked).toBe(true);

    // Link Apple identity
    const link2 = await service.linkIdentity(user.id, {
      provider: AuthProvider.APPLE,
      identifier: 'apple-sub-67890',
    });
    expect(link2.linked).toBe(true);

    const list = await service.listIdentities(user.id);
    expect(list.data.length).toBe(2);

    // Unlinking one of two should succeed
    const unlinked = await service.unlinkIdentity(user.id, link1.id!);
    expect(unlinked.unlinked).toBe(true);

    // Unlinking sole remaining identity should fail to prevent account lockout
    await expect(service.unlinkIdentity(user.id, link2.id!)).rejects.toThrow(BadRequestException);
  });

  it('creates and revokes active device sessions', async () => {
    const user = await store.user.create({ data: { authId: 'phone:+919988776644' } });
    const session = await sessionService.createSession(
      user.id,
      'test-jti-session',
      new Date(Date.now() + 3600000),
      { deviceName: 'Pixel 8', platform: 'Android' },
    );

    const activeList = await sessionService.listActiveSessions(user.id);
    expect(activeList.data.length).toBe(1);
    expect(activeList.data[0].device_name).toBe('Pixel 8');

    // Revoke session
    const rev = await sessionService.revokeSession(session.id, user.id);
    expect(rev.revoked).toBe(true);

    const afterList = await sessionService.listActiveSessions(user.id);
    expect(afterList.data.length).toBe(0);
  });
});
