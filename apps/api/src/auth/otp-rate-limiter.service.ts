import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

interface OtpBucket {
  code: string;
  expiresAt: number;
  lastSentAt: number;
  sendCount: number;
  windowStart: number;
  failedAttempts: number;
  lockedUntil: number;
}

@Injectable()
export class OtpRateLimiterService {
  private readonly buckets = new Map<string, OtpBucket>();
  private readonly maxSendsPerWindow = 5;
  private readonly windowMs = 15 * 60 * 1000;
  private readonly cooldownMs = 30 * 1000;
  private readonly otpTtlMs = 5 * 60 * 1000;
  private readonly maxFailedAttempts = 5;
  private readonly lockDurationMs = 15 * 60 * 1000;

  issueOtp(key: string, bypassCooldown = false): { code: string; expiresInSeconds: number } {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (existing) {
      if (existing.lockedUntil > now) {
        throw new HttpException(
          {
            error: 'OTP_TEMP_LOCKED',
            message: 'Too many failed attempts. Please try again later.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (!bypassCooldown && now - existing.lastSentAt < this.cooldownMs) {
        throw new HttpException(
          {
            error: 'OTP_COOLDOWN_ACTIVE',
            message: 'Please wait before requesting another OTP.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const inWindow = now - existing.windowStart < this.windowMs;
      const nextCount = inWindow ? existing.sendCount + 1 : 1;
      if (nextCount > this.maxSendsPerWindow) {
        throw new HttpException(
          {
            error: 'OTP_RATE_LIMIT_EXCEEDED',
            message: 'Maximum OTP requests reached. Please try again later.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const code = this.generateCode();
      this.buckets.set(key, {
        code,
        expiresAt: now + this.otpTtlMs,
        lastSentAt: now,
        sendCount: nextCount,
        windowStart: inWindow ? existing.windowStart : now,
        failedAttempts: 0,
        lockedUntil: 0,
      });
      return { code, expiresInSeconds: Math.floor(this.otpTtlMs / 1000) };
    }

    const code = this.generateCode();
    this.buckets.set(key, {
      code,
      expiresAt: now + this.otpTtlMs,
      lastSentAt: now,
      sendCount: 1,
      windowStart: now,
      failedAttempts: 0,
      lockedUntil: 0,
    });
    return { code, expiresInSeconds: Math.floor(this.otpTtlMs / 1000) };
  }

  verifyOtp(key: string, candidate: string, allowDevOtp: boolean): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (bucket && bucket.lockedUntil > now) {
      throw new HttpException(
        {
          error: 'OTP_TEMP_LOCKED',
          message: 'Too many failed verification attempts. Try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (allowDevOtp && candidate === '123456') {
      this.buckets.delete(key);
      return true;
    }

    if (!bucket || bucket.expiresAt < now) {
      return false;
    }

    if (bucket.code === candidate) {
      this.buckets.delete(key);
      return true;
    }

    bucket.failedAttempts += 1;
    if (bucket.failedAttempts >= this.maxFailedAttempts) {
      bucket.lockedUntil = now + this.lockDurationMs;
    }
    return false;
  }

  clear(key?: string): void {
    if (key) {
      this.buckets.delete(key);
    } else {
      this.buckets.clear();
    }
  }

  private generateCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }
}
