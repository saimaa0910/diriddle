import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import * as crypto from 'crypto';

export class OtpTooManyRequestsException extends HttpException {
  constructor(response: string | Record<string, any>) {
    super(response, HttpStatus.TOO_MANY_REQUESTS);
  }
}

@Injectable()
export class OtpStorageService {
  private readonly logger = new Logger(OtpStorageService.name);

  private readonly OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly COOLDOWN_MS = 60 * 1000; // 60 seconds between sends
  private readonly MAX_VERIFY_ATTEMPTS = 5;
  private readonly MAX_DAILY_OTP = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private hashOtp(code: string, salt: string): string {
    return crypto.pbkdf2Sync(code, salt, 10000, 32, 'sha256').toString('hex');
  }

  /**
   * Issue a new OTP for the given key (e.g. "phone:+91...").
   * Returns the raw code ONLY so caller can dispatch via SMS/email.
   * Raw code must NEVER be logged or returned in public API responses.
   */
  async issueOtp(key: string, allowBypassCooldown = false): Promise<{ code: string; expiresInSeconds: number }> {
    const now = new Date();

    const existing = await this.prisma.otpChallenge.findFirst({
      where: { identifier: key },
      orderBy: { createdAt: 'desc' },
    });

    // Cooldown check
    if (!allowBypassCooldown && existing && existing.lastSentAt) {
      const msSinceLast = now.getTime() - new Date(existing.lastSentAt).getTime();
      if (msSinceLast < this.COOLDOWN_MS) {
        const waitSec = Math.ceil((this.COOLDOWN_MS - msSinceLast) / 1000);
        throw new OtpTooManyRequestsException({
          error: 'OTP_RATE_LIMITED',
          message: `Please wait ${waitSec} seconds before requesting another OTP`,
          retry_after: waitSec,
        });
      }
    }

    // Daily limit check
    const dailyWindowStart = this.getDailyWindowStart(now, existing);
    const currentDailyCount = this.getCurrentDailyCount(now, existing, dailyWindowStart);

    if (currentDailyCount >= this.MAX_DAILY_OTP) {
      throw new OtpTooManyRequestsException({
        error: 'OTP_DAILY_LIMIT_EXCEEDED',
        message: 'Maximum OTP requests for today exceeded. Try again tomorrow.',
        retry_after: this.getSecondsUntilNextDay(now),
      });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedCode = this.hashOtp(code, key);
    const expiresAt = new Date(now.getTime() + this.OTP_TTL_MS);

    await this.prisma.otpChallenge.create({
      data: {
        identifier: key,
        hashedCode,
        expiresAt,
        attempts: 0,
        dailyCount: currentDailyCount + 1,
        dailyWindowStart,
        lastSentAt: now,
      },
    });

    this.logger.debug(`OTP issued for identifier hash: ${key.substring(0, 6)}***`);
    return { code, expiresInSeconds: this.OTP_TTL_MS / 1000 };
  }

  /**
   * Verify the submitted OTP code against the stored hash.
   */
  async verifyOtp(key: string, code: string, allowDevOtp: boolean): Promise<boolean> {
    const now = new Date();
    const record = await this.prisma.otpChallenge.findFirst({
      where: {
        identifier: key,
        usedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (record && record.attempts >= this.MAX_VERIFY_ATTEMPTS) {
      await this.prisma.otpChallenge.update({
        where: { id: record.id },
        data: { usedAt: now },
      });
      throw new OtpTooManyRequestsException({
        error: 'OTP_ATTEMPTS_EXCEEDED',
        message: 'Too many incorrect attempts. Request a new OTP.',
      });
    }

    if (allowDevOtp && code === '123456') {
      this.logger.warn('Dev OTP 123456 accepted');
      return true;
    }

    if (!record) return false;

    if (record.attempts >= this.MAX_VERIFY_ATTEMPTS) {
      await this.prisma.otpChallenge.update({
        where: { id: record.id },
        data: { usedAt: now },
      });
      throw new OtpTooManyRequestsException({
        error: 'OTP_ATTEMPTS_EXCEEDED',
        message: 'Too many incorrect attempts. Request a new OTP.',
      });
    }

    const expectedHash = this.hashOtp(code, key);
    let match = false;
    try {
      match = crypto.timingSafeEqual(
        Buffer.from(record.hashedCode, 'hex'),
        Buffer.from(expectedHash, 'hex'),
      );
    } catch {
      match = false;
    }

    if (!match) {
      await this.prisma.otpChallenge.update({
        where: { id: record.id },
        data: { attempts: record.attempts + 1 },
      });
      return false;
    }

    // Invalidate on success
    await this.prisma.otpChallenge.update({
      where: { id: record.id },
      data: { usedAt: now },
    });

    return true;
  }

  /**
   * Invalidate OTP for identifier.
   */
  async invalidate(key: string): Promise<void> {
    await this.prisma.otpChallenge.updateMany({
      where: { identifier: key, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  private getDailyWindowStart(now: Date, existing: any): Date {
    if (!existing || !existing.dailyWindowStart) {
      return this.startOfDay(now);
    }
    const windowDate = new Date(existing.dailyWindowStart);
    if (windowDate.toDateString() !== now.toDateString()) {
      return this.startOfDay(now);
    }
    return windowDate;
  }

  private getCurrentDailyCount(now: Date, existing: any, windowStart: Date): number {
    if (!existing || !existing.dailyWindowStart) return 0;
    const existingWindow = new Date(existing.dailyWindowStart);
    if (existingWindow.toDateString() !== now.toDateString()) return 0;
    return existing.dailyCount ?? 0;
  }

  private startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private getSecondsUntilNextDay(now: Date): number {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return Math.ceil((tomorrow.getTime() - now.getTime()) / 1000);
  }
}
