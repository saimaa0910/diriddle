import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';

export class TooManyRequestsException extends HttpException {
  constructor(response: string | Record<string, any>) {
    super(response, HttpStatus.TOO_MANY_REQUESTS);
  }
}

interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

@Injectable()
export class OtpRateLimiterService {
  private readonly logger = new Logger(OtpRateLimiterService.name);
  private readonly store = new Map<string, OtpEntry>();

  private readonly OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
  private readonly COOLDOWN_MS = 60 * 1000; // 1 minute between sends
  private readonly MAX_VERIFY_ATTEMPTS = 5;

  issueOtp(key: string, bypassCooldown = false): { code: string; expiresInSeconds: number } {
    const now = Date.now();
    const existing = this.store.get(key);

    if (!bypassCooldown && existing && now - existing.lastSentAt < this.COOLDOWN_MS) {
      const waitSec = Math.ceil((this.COOLDOWN_MS - (now - existing.lastSentAt)) / 1000);
      throw new TooManyRequestsException({
        error: 'OTP_RATE_LIMITED',
        message: `Please wait ${waitSec} seconds before requesting another OTP`,
        retry_after: waitSec,
      });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.store.set(key, {
      code,
      expiresAt: now + this.OTP_TTL_MS,
      attempts: 0,
      lastSentAt: now,
    });

    this.logger.debug(`OTP issued for key hash: ${key.substring(0, 8)}***`);
    return { code, expiresInSeconds: this.OTP_TTL_MS / 1000 };
  }

  verifyOtp(key: string, submitted: string, allowDevOtp: boolean): boolean {
    const now = Date.now();
    const entry = this.store.get(key);

    if (entry && entry.attempts >= this.MAX_VERIFY_ATTEMPTS) {
      this.store.delete(key);
      return false;
    }

    if (allowDevOtp && submitted === '123456') {
      this.logger.warn('Dev OTP accepted — ensure ALLOW_DEV_OTP=false in production');
      return true;
    }

    if (!entry || entry.expiresAt < now) {
      return false;
    }

    entry.attempts += 1;
    if (entry.attempts > this.MAX_VERIFY_ATTEMPTS) {
      this.store.delete(key);
      return false;
    }

    if (entry.code !== submitted) {
      return false;
    }

    this.store.delete(key); // Consume on success
    return true;
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  clear(key?: string): void {
    if (key) {
      this.store.delete(key);
    } else {
      this.store.clear();
    }
  }
}
