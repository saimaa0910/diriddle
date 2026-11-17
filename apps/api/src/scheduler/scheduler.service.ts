import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { TrendingService } from '../feed/trending.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly trendingService: TrendingService,
    private readonly usersService: UsersService,
  ) {}

  onModuleInit() {
    const isTest = process.env.NODE_ENV === 'test';
    const schedulerEnabled = this.configService.get<string>('ENABLE_SCHEDULER', 'true') !== 'false';

    if (!isTest && schedulerEnabled) {
      this.logger.log('Initializing background processing jobs...');

      // 1m: Cleanup ephemeral GPS locations
      this.timers.push(
        setInterval(() => this.cleanupExpiredGps(), 60 * 1000),
      );

      // 5m: Cleanup expired OTPs
      this.timers.push(
        setInterval(() => this.cleanupExpiredOtps(), 5 * 60 * 1000),
      );

      // 15m: Refresh trending scores
      this.timers.push(
        setInterval(() => this.refreshTrendingScores(), 15 * 60 * 1000),
      );

      // 1h: Expire stale sessions
      this.timers.push(
        setInterval(() => this.expireOldSessions(), 60 * 60 * 1000),
      );

      // 1h: Process scheduled account deletions
      this.timers.push(
        setInterval(() => this.processScheduledDeletions(), 60 * 60 * 1000),
      );

      // 1h: Expire temporary community bans
      this.timers.push(
        setInterval(() => this.expireTemporaryBans(), 60 * 60 * 1000),
      );

      // 6h: Database integrity reconciliation
      this.timers.push(
        setInterval(() => this.reconcileDenormalizedCounts(), 6 * 60 * 60 * 1000),
      );
    }
  }

  onModuleDestroy() {
    this.timers.forEach((t) => clearInterval(t));
    this.timers = [];
  }

  /**
   * Deletes expired or used OTP challenges from the persistent store.
   */
  async cleanupExpiredOtps(): Promise<{ count: number }> {
    const now = new Date();
    try {
      const res = await this.prisma.otpChallenge.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { usedAt: { not: null } },
          ],
        },
      });
      if (res.count > 0) {
        this.logger.log(`Cleaned up ${res.count} expired/used OTP challenges.`);
      }
      return { count: res.count };
    } catch (err: any) {
      this.logger.error(`Error cleaning up OTP challenges: ${err.message}`);
      return { count: 0 };
    }
  }

  /**
   * Deletes expired ephemeral user GPS coordinates to preserve location privacy.
   */
  async cleanupExpiredGps(): Promise<{ count: number }> {
    const now = new Date();
    try {
      const res = await this.prisma.temporaryUserGps.deleteMany({
        where: {
          expiresAt: { lt: now },
        },
      });
      if (res.count > 0) {
        this.logger.log(`Cleaned up ${res.count} expired ephemeral GPS locations.`);
      }
      return { count: res.count };
    } catch (err: any) {
      this.logger.error(`Error cleaning up expired GPS locations: ${err.message}`);
      return { count: 0 };
    }
  }

  /**
   * Revokes sessions that have passed their expiration timestamp.
   */
  async expireOldSessions(): Promise<{ count: number }> {
    const now = new Date();
    try {
      const res = await this.prisma.session.updateMany({
        where: {
          revokedAt: null,
          expiresAt: { lt: now },
        },
        data: {
          revokedAt: now,
        },
      });
      if (res.count > 0) {
        this.logger.log(`Revoked ${res.count} expired user sessions.`);
      }
      return { count: res.count };
    } catch (err: any) {
      this.logger.error(`Error expiring old sessions: ${err.message}`);
      return { count: 0 };
    }
  }

  /**
   * Triggers global trending score recalculation.
   */
  async refreshTrendingScores(): Promise<{ processed: number; updated: number }> {
    try {
      return await this.trendingService.refreshTrendingScores();
    } catch (err: any) {
      this.logger.error(`Error refreshing trending scores: ${err.message}`);
      return { processed: 0, updated: 0 };
    }
  }

  /**
   * Processes pending deletion requests whose scheduled recovery period has passed.
   */
  async processScheduledDeletions(): Promise<{ processed: number; success: number }> {
    const now = new Date();
    try {
      const dueDeletions = await this.prisma.deletionRequest.findMany({
        where: {
          status: 'PENDING',
          scheduledAt: { lte: now },
        },
      });

      let successCount = 0;
      for (const req of dueDeletions) {
        try {
          await this.usersService.deleteAccount(
            req.userId,
            req.reason ?? 'scheduled_retention_deletion',
          );
          await this.prisma.deletionRequest.update({
            where: { id: req.id },
            data: { status: 'EXECUTED', executedAt: now },
          });
          successCount++;
        } catch (subErr: any) {
          this.logger.error(`Failed to execute deletion for user ${req.userId}: ${subErr.message}`);
        }
      }

      if (dueDeletions.length > 0) {
        this.logger.log(`Processed ${dueDeletions.length} scheduled account deletions (${successCount} successful).`);
      }
      return { processed: dueDeletions.length, success: successCount };
    } catch (err: any) {
      this.logger.error(`Error processing scheduled deletions: ${err.message}`);
      return { processed: 0, success: 0 };
    }
  }

  /**
   * Deactivates community bans whose expiration timestamp has elapsed.
   */
  async expireTemporaryBans(): Promise<{ count: number }> {
    const now = new Date();
    try {
      const res = await this.prisma.communityBan.updateMany({
        where: {
          isActive: true,
          expiresAt: { not: null, lt: now },
        },
        data: {
          isActive: false,
        },
      });
      if (res.count > 0) {
        this.logger.log(`Expired ${res.count} temporary community bans.`);
      }
      return { count: res.count };
    } catch (err: any) {
      this.logger.error(`Error expiring temporary community bans: ${err.message}`);
      return { count: 0 };
    }
  }

  /**
   * Reconciles denormalized counters and detects/cleans orphan records.
   */
  async reconcileDenormalizedCounts(): Promise<{ reconciledCommunities: number; reconciledPosts: number; orphanCleaned: number }> {
    let reconciledCommunities = 0;
    let reconciledPosts = 0;
    let orphanCleaned = 0;

    try {
      // 1. Reconcile community member counts
      const communities = await this.prisma.community.findMany({
        where: { status: 'ACTIVE' },
        take: 100,
      });

      for (const comm of communities) {
        const actualMembers = await this.prisma.communityMember.count({
          where: { communityId: comm.id, status: 'ACTIVE' },
        });
        if ((comm as any).memberCount !== actualMembers) {
          await this.prisma.community.update({
            where: { id: comm.id },
            data: { memberCount: actualMembers } as any,
          });
          reconciledCommunities++;
        }
      }

      // 2. Clean orphaned pending attachments older than 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const res = await this.prisma.attachment.updateMany({
        where: {
          status: 'PENDING',
          createdAt: { lt: oneDayAgo },
        },
        data: {
          status: 'DELETED',
          deletedAt: new Date(),
        },
      });
      orphanCleaned = res.count;

      this.logger.log(`Integrity reconciliation: ${reconciledCommunities} communities reconciled, ${orphanCleaned} orphan attachments cleaned.`);
    } catch (err: any) {
      this.logger.error(`Error during integrity reconciliation: ${err.message}`);
    }

    return { reconciledCommunities, reconciledPosts, orphanCleaned };
  }

  /**
   * Executes all background maintenance jobs on-demand.
   */
  async runAllJobs() {
    const [otps, gps, sessions, trending, deletions, bans, reconciliation] = await Promise.all([
      this.cleanupExpiredOtps(),
      this.cleanupExpiredGps(),
      this.expireOldSessions(),
      this.refreshTrendingScores(),
      this.processScheduledDeletions(),
      this.expireTemporaryBans(),
      this.reconcileDenormalizedCounts(),
    ]);

    return {
      cleaned_otps: otps.count,
      cleaned_gps: gps.count,
      expired_sessions: sessions.count,
      trending_posts_updated: trending.updated,
      deletions_processed: deletions.success,
      expired_bans: bans.count,
      reconciliation,
      timestamp: new Date(),
    };
  }
}
