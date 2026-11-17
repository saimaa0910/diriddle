import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthProvider } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../database/prisma.service';
import { OtpRateLimiterService } from './otp-rate-limiter.service';
import { OtpStorageService } from './otp-storage.service';
import { SessionService, DeviceInfo } from './session.service';
import { TokenRevocationService } from './token-revocation.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyAgeDto } from './dto/verify-age.dto';
import { LinkIdentityDto } from './dto/link-identity.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly otpRateLimiter: OtpRateLimiterService,
    private readonly otpStorage: OtpStorageService,
    private readonly sessionService: SessionService,
    private readonly tokenRevocationService: TokenRevocationService,
  ) {}

  async sendOtp(dto: SendOtpDto) {
    const normalized = this.normalizeIdentifier(dto.identifier, dto.type);
    const key = `${dto.type}:${normalized}`;
    const allowBypassCooldown = process.env.NODE_ENV === 'test';
    const { code, expiresInSeconds } = this.otpRateLimiter.issueOtp(key, allowBypassCooldown);

    try {
      await this.otpStorage.issueOtp(key, allowBypassCooldown);
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') {
        throw err;
      }
    }

    const response: Record<string, any> = {
      message: `OTP sent to ${dto.type}`,
      expires_in: expiresInSeconds,
    };

    if (this.isDevOtpAllowed()) {
      response.dev_otp_hint = 'Use 123456 or issued OTP in dev/test mode';
      if (process.env.NODE_ENV === 'test') {
        response.dev_code = code;
      }
    }

    return response;
  }

  async verifyOtp(dto: VerifyOtpDto, deviceInfo?: DeviceInfo) {
    const normalized = this.normalizeIdentifier(dto.identifier, dto.type);
    const key = `${dto.type}:${normalized}`;

    let valid = this.otpRateLimiter.verifyOtp(key, dto.otp, this.isDevOtpAllowed());
    if (!valid) {
      try {
        valid = await this.otpStorage.verifyOtp(key, dto.otp, this.isDevOtpAllowed());
      } catch {
        valid = false;
      }
    }

    if (!valid) {
      throw new UnauthorizedException({
        error: 'INVALID_OTP',
        message: 'Invalid or expired OTP',
      });
    }

    let user = await this.prisma.user.findUnique({
      where: { authId: key },
      include: { adminRole: true },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          authId: key,
          status: 'ACTIVE',
          ageVerified: false,
        },
        include: { adminRole: true },
      });
    }

    const provider = dto.type === 'phone' ? 'PHONE' : 'EMAIL';
    try {
      await this.prisma.authIdentity.upsert({
        where: {
          provider_identifier: {
            provider: provider as any,
            identifier: normalized,
          },
        },
        create: {
          userId: user.id,
          provider: provider as any,
          identifier: normalized,
          verifiedAt: new Date(),
          isPrimary: true,
        },
        update: {
          verifiedAt: new Date(),
        },
      });
    } catch {
      // In-memory or concurrent safe fallback
    }

    if (user.deletedAt || user.status === 'DELETED') {
      throw new ForbiddenException({
        error: 'ACCOUNT_DELETED',
        message: 'This account has been deleted',
      });
    }
    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException({
        error: 'ACCOUNT_SUSPENDED',
        message: 'This account has been suspended',
      });
    }

    const tokens = await this.issueTokens(user.authId, user.id);

    try {
      await this.sessionService.createSession(
        user.id,
        tokens.refresh_jti,
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deviceInfo,
      );
      await this.sessionService.recordLoginAttempt(user.id, deviceInfo ?? {}, true);
    } catch {
      // In-memory or logging errors should not block auth
    }

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type,
      expires_in: tokens.expires_in,
      user: {
        id: user.id,
        age_verified: user.ageVerified,
        status: user.status,
        admin_role: user.adminRole?.role ?? null,
      },
    };
  }

  async refresh(dto: RefreshTokenDto) {
    try {
      const refreshSecret = this.getRefreshSecret();
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        uid: string;
        jti: string;
        type: string;
      }>(dto.refresh_token, { secret: refreshSecret });

      if (payload.type !== 'refresh' || this.tokenRevocationService.isRevoked(payload.jti)) {
        throw new UnauthorizedException({
          error: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token is invalid or revoked',
        });
      }

      const activeSession = await this.prisma.session.findFirst({
        where: { jti: payload.jti, revokedAt: null },
      });
      if (!activeSession) {
        throw new UnauthorizedException({
          error: 'INVALID_REFRESH_TOKEN',
          message: 'Session has been revoked or expired',
        });
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.uid },
      });
      if (!user || user.deletedAt || user.status !== 'ACTIVE') {
        throw new UnauthorizedException({
          error: 'UNAUTHORIZED',
          message: 'Account unavailable',
        });
      }

      this.tokenRevocationService.revoke(payload.jti, Date.now() + 7 * 24 * 60 * 60 * 1000);
      return this.issueTokens(user.authId, user.id);
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException({
        error: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid or expired',
      });
    }
  }

  async logout(refreshToken?: string) {
    if (refreshToken) {
      try {
        const payload = await this.jwtService.verifyAsync<{ jti?: string }>(refreshToken, {
          secret: this.getRefreshSecret(),
        });
        if (payload?.jti) {
          this.tokenRevocationService.revoke(payload.jti, Date.now() + 7 * 24 * 60 * 60 * 1000);
        }
      } catch {
        // Ignore invalid refresh token on logout
      }
    }
    return;
  }

  async verifyAge(userId: string, dto: VerifyAgeDto, ipAddress?: string) {
    const is18 = dto.confirmed_18_plus ?? dto.confirmed ?? false;
    if (!is18) {
      throw new BadRequestException({
        error: 'AGE_REQUIREMENT_NOT_MET',
        message: 'You must be at least 18 years old to use diriddle',
      });
    }
    const terms = dto.accepted_terms ?? (dto.confirmed ? true : false);
    const privacy = dto.accepted_privacy ?? (dto.confirmed ? true : false);
    if (!terms || !privacy) {
      throw new BadRequestException({
        error: 'CONSENT_REQUIRED',
        message: 'Terms of Service and Privacy Policy acceptance are required',
      });
    }

    const version = dto.policy_version ?? '1.0';
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { ageVerified: true } }),
      this.prisma.ageVerification.upsert({
        where: { userId },
        create: {
          userId,
          status: 'VERIFIED',
          method: 'SELF_ATTESTATION',
          verifiedAt: new Date(),
          policyVersion: version,
        },
        update: {
          status: 'VERIFIED',
          method: 'SELF_ATTESTATION',
          verifiedAt: new Date(),
          policyVersion: version,
        },
      }),
      this.prisma.userConsent.create({
        data: {
          userId,
          consentType: 'AGE_18_PLUS',
          version,
          granted: true,
          ipAddress: ipAddress ?? null,
        },
      }),
      this.prisma.userConsent.create({
        data: {
          userId,
          consentType: 'TERMS_OF_SERVICE',
          version,
          granted: true,
          ipAddress: ipAddress ?? null,
        },
      }),
      this.prisma.userConsent.create({
        data: {
          userId,
          consentType: 'PRIVACY_POLICY',
          version,
          granted: true,
          ipAddress: ipAddress ?? null,
        },
      }),
    ]);

    return {
      age_verified: true,
      policy_version: version,
    };
  }

  async linkIdentity(userId: string, dto: LinkIdentityDto) {
    const normalized = dto.identifier.trim().toLowerCase();
    const existing = await this.prisma.authIdentity.findUnique({
      where: {
        provider_identifier: {
          provider: dto.provider,
          identifier: normalized,
        },
      },
    });

    if (existing) {
      if (existing.userId === userId) {
        return { message: 'Identity already linked to this account', identity_id: existing.id };
      }
      throw new ConflictException({
        error: 'IDENTITY_ALREADY_LINKED',
        message: 'This identity is already associated with another account',
      });
    }

    const created = await this.prisma.authIdentity.create({
      data: {
        userId,
        provider: dto.provider,
        identifier: normalized,
        verifiedAt: new Date(),
        isPrimary: false,
      },
    });

    return {
      id: created.id,
      provider: created.provider,
      identifier: created.identifier,
      linked: true,
    };
  }

  async unlinkIdentity(userId: string, identityId: string) {
    const identities = await this.prisma.authIdentity.findMany({ where: { userId } });
    if (identities.length <= 1) {
      throw new BadRequestException({
        error: 'CANNOT_UNLINK_SOLE_IDENTITY',
        message: 'Cannot unlink the only authentication identity from your account',
      });
    }

    const target = identities.find((i) => i.id === identityId);
    if (!target) {
      throw new NotFoundException({
        error: 'IDENTITY_NOT_FOUND',
        message: 'Linked identity not found',
      });
    }

    await this.prisma.authIdentity.delete({ where: { id: identityId } });
    return { unlinked: true, id: identityId };
  }

  async listIdentities(userId: string) {
    const identities = await this.prisma.authIdentity.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      data: identities.map((i) => ({
        id: i.id,
        provider: i.provider,
        identifier: i.identifier,
        is_primary: i.isPrimary,
        created_at: i.createdAt,
      })),
    };
  }

  async issueTokens(authId: string, userId: string) {
    const jti = uuidv4();
    const accessSecret = this.configService.get<string>('JWT_SECRET', 'dev-secret');
    const refreshSecret = this.getRefreshSecret();

    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(
        { sub: authId, uid: userId, type: 'access' },
        { secret: accessSecret, expiresIn: '15m' },
      ),
      this.jwtService.signAsync(
        { sub: authId, uid: userId, jti, type: 'refresh' },
        { secret: refreshSecret, expiresIn: '7d' },
      ),
    ]);

    return { access_token, refresh_token, token_type: 'Bearer', expires_in: 900, refresh_jti: jti };
  }

  private getRefreshSecret(): string {
    return this.configService.get<string>(
      'JWT_REFRESH_SECRET',
      this.configService.get<string>('JWT_SECRET', 'dev-secret') + '-refresh',
    );
  }

  private isDevOtpAllowed(): boolean {
    return (
      process.env.ALLOW_DEV_OTP === 'true' ||
      process.env.DEV_IN_MEMORY === 'true' ||
      process.env.NODE_ENV !== 'production'
    );
  }

  private normalizeIdentifier(identifier: string, type: 'phone' | 'email'): string {
    const trimmed = identifier.trim();
    return type === 'email' ? trimmed.toLowerCase() : trimmed.replace(/\s+/g, '');
  }
}
