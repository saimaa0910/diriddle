import { Injectable, Logger } from '@nestjs/common';

/**
 * Token revocation store.
 * Current implementation: in-memory Map (acceptable for single-instance dev).
 * Production upgrade path: inject RedisService and use SETEX with TTL matching JWT expiry.
 */
@Injectable()
export class TokenRevocationService {
  private readonly logger = new Logger(TokenRevocationService.name);
  // key: jti, value: expiry timestamp (ms)
  private readonly revoked = new Map<string, number>();
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

  constructor() {
    // Periodic cleanup of expired entries to prevent memory growth
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL_MS).unref();
  }

  revoke(jti: string, expiresAtMs: number): void {
    this.revoked.set(jti, expiresAtMs);
  }

  isRevoked(jti: string): boolean {
    const exp = this.revoked.get(jti);
    if (exp === undefined) return false;
    if (Date.now() > exp) {
      this.revoked.delete(jti);
      return false;
    }
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [jti, exp] of this.revoked) {
      if (now > exp) this.revoked.delete(jti);
    }
    this.logger.debug(`Token revocation store: ${this.revoked.size} active entries`);
  }
}
