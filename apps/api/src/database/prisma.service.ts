import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { InMemoryPrismaStore } from './in-memory-prisma';

const DELEGATE_NAMES = [
  'user',
  'anonymousIdentity',
  'community',
  'communityMember',
  'post',
  'postMedia',
  'comment',
  'reaction',
  'savedPost',
  'report',
  'block',
  'notification',
  'deviceToken',
  'notificationPreference',
  'moderationAction',
  'moderationAppeal',
  'auditLog',
  'userConsent',
  'locationPreference',
  'idempotencyKey',
  'poll',
  'pollOption',
  'pollVote',
  'adminRole',
  'userProfile',
  'authIdentity',
  'session',
  'loginHistory',
  'deletionRequest',
  'ageVerification',
  'country',
  'state',
  'city',
  'spatialCell',
  'temporaryUserGps',
  'communityRule',
  'communityBan',
  'joinRequest',
  'communityRole',
  'identityHistory',
  'postAudience',
  'attachment',
  'hashtag',
  'postHashtag',
  'mention',
  'trendingScore',
  'searchHistory',
  'identityAccessLog',
  'retentionPolicy',
  'otpChallenge',
  'commentReaction',
] as const;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private inMemoryStore: InMemoryPrismaStore | null = null;
  public isInMemory = false;

  constructor() {
    super();
    if (process.env.DEV_IN_MEMORY === 'true') {
      this.activateInMemory();
    }
  }

  private activateInMemory(): void {
    if (this.inMemoryStore) return;
    this.inMemoryStore = new InMemoryPrismaStore();
    this.isInMemory = true;

    for (const modelName of DELEGATE_NAMES) {
      Object.defineProperty(this, modelName, {
        value: this.inMemoryStore[modelName],
        configurable: true,
        enumerable: true,
        writable: true,
      });
    }

    Object.defineProperty(this, '$transaction', {
      value: this.inMemoryStore.$transaction.bind(this.inMemoryStore),
      configurable: true,
      writable: true,
    });
  }

  resetInMemory(): void {
    this.inMemoryStore?.reset();
  }

  async onModuleInit(): Promise<void> {
    if (this.isInMemory) {
      this.logger.log('Running in DEV_IN_MEMORY=true mode (PostgreSQL bypassed)');
      return;
    }

    try {
      await this.$connect();
      this.logger.log('Connected to PostgreSQL');
    } catch (err) {
      if (process.env.NODE_ENV !== 'production' && process.env.DEV_IN_MEMORY !== 'false') {
        this.logger.warn(
          'PostgreSQL unavailable; falling back to DEV_IN_MEMORY store for local testing',
        );
        this.activateInMemory();
        return;
      }
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.isInMemory) {
      await this.$disconnect();
    }
  }
}

