import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { OtpRateLimiterService } from './otp-rate-limiter.service';
import { PrismaService } from '../database/prisma.service';
import { InMemoryPrismaStore } from '../database/in-memory-prisma';

describe('AuthService', () => {
  let service: AuthService;
  let store: InMemoryPrismaStore;
  let rateLimiter: OtpRateLimiterService;

  beforeEach(async () => {
    process.env.ALLOW_DEV_OTP = 'true';
    process.env.NODE_ENV = 'test';
    store = new InMemoryPrismaStore();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        OtpRateLimiterService,
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
    rateLimiter = module.get(OtpRateLimiterService);
  });

  afterEach(() => {
    rateLimiter.clear();
  });

  it('sends and verifies dev OTP 123456 and returns JWT tokens', async () => {
    const sendRes = await service.sendOtp({ identifier: '+919900112233', type: 'phone' });
    expect(sendRes.expires_in).toBe(300);

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
});
