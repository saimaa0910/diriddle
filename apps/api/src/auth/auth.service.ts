import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../database/prisma.service';
import { OtpRateLimiterService } from './otp-rate-limiter.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyAgeDto } from './dto/verify-age.dto';

@Injectable()
export class AuthService {
  private readonly revokedJtis = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly otpRateLimiter: OtpRateLimiterService,
  ) {}

  async sendOtp(dto: SendOtpDto) {
    const normalized = this.normalizeIdentifier(dto.identifier, dto.type);
    const key = `${dto.type}:${normalized}`;
    const allowBypassCooldown = process.env.NODE_ENV === 'test';
    const { code, expiresInSeconds } = this.otpRateLimiter.issueOtp(key, allowBypassCooldown);

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

  async verifyOtp(dto: VerifyOtpDto) {
    const normalized = this.normalizeIdentifier(dto.identifier, dto.type);
    const key = `${dto.type}:${normalized}`;

    const valid = this.otpRateLimiter.verifyOtp(key, dto.otp, this.isDevOtpAllowed());
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

    return {
      ...tokens,
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

      if (payload.type !== 'refresh' || this.revokedJtis.has(payload.jti)) {
        throw new UnauthorizedException({
          error: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token is invalid or revoked',
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

      this.revokedJtis.add(payload.jti);
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
          this.revokedJtis.add(payload.jti);
        }
      } catch {
        // Ignore invalid refresh token on logout
      }
    }
    return;
  }

  async verifyAge(userId: string, dto: VerifyAgeDto, ipAddress?: string) {
    if (!dto.confirmed_18_plus) {
      throw new BadRequestException({
        error: 'AGE_REQUIREMENT_NOT_MET',
        message: 'You must be at least 18 years old to use diriddle',
      });
    }
    if (!dto.accepted_terms || !dto.accepted_privacy) {
      throw new BadRequestException({
        error: 'CONSENT_REQUIRED',
        message: 'Terms of Service and Privacy Policy acceptance are required',
      });
    }

    const version = dto.policy_version ?? '1.0';
    await this.prisma.user.update({
      where: { id: userId },
      data: { ageVerified: true },
    });

    await Promise.all([
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

  private async issueTokens(authId: string, userId: string) {
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

    return { access_token, refresh_token, token_type: 'Bearer', expires_in: 900 };
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
