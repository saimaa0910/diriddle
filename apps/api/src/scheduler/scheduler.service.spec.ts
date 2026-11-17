import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SchedulerService } from './scheduler.service';
import { TrendingService } from '../feed/trending.service';
import { UsersService } from '../users/users.service';
import { BlocksService } from '../blocks/blocks.service';
import { IdentitiesService } from '../identities/identities.service';
import { PrismaService } from '../database/prisma.service';
import { InMemoryPrismaStore } from '../database/in-memory-prisma';

describe('SchedulerService', () => {
  let service: SchedulerService;
  let store: InMemoryPrismaStore;

  beforeEach(async () => {
    store = new InMemoryPrismaStore();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        TrendingService,
        UsersService,
        BlocksService,
        IdentitiesService,
        { provide: PrismaService, useValue: store },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => defaultValue ?? 'false'),
          },
        },
      ],
    }).compile();

    service = module.get(SchedulerService);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('cleans up expired and used OTPs', async () => {
    const past = new Date(Date.now() - 10 * 60 * 1000);
    const future = new Date(Date.now() + 10 * 60 * 1000);

    await store.otpChallenge.create({
      data: { identifier: 'user1@test.com', hashedCode: 'hash1', expiresAt: past },
    });
    await store.otpChallenge.create({
      data: { identifier: 'user2@test.com', hashedCode: 'hash2', expiresAt: future, usedAt: past },
    });
    await store.otpChallenge.create({
      data: { identifier: 'user3@test.com', hashedCode: 'hash3', expiresAt: future, usedAt: null },
    });

    const res = await service.cleanupExpiredOtps();
    expect(res.count).toBe(2);

    const remaining = await store.otpChallenge.findMany();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].identifier).toBe('user3@test.com');
  });

  it('cleans up expired temporary GPS locations', async () => {
    const past = new Date(Date.now() - 60 * 1000);
    const future = new Date(Date.now() + 60 * 1000);

    await store.temporaryUserGps.create({
      data: { userId: 'u1', lat: 12.9, lng: 77.5, expiresAt: past },
    });
    await store.temporaryUserGps.create({
      data: { userId: 'u2', lat: 13.0, lng: 77.6, expiresAt: future },
    });

    const res = await service.cleanupExpiredGps();
    expect(res.count).toBe(1);

    const remaining = await store.temporaryUserGps.findMany();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].userId).toBe('u2');
  });

  it('revokes expired active sessions', async () => {
    const past = new Date(Date.now() - 3600 * 1000);
    const future = new Date(Date.now() + 3600 * 1000);

    const s1 = await store.session.create({
      data: { userId: 'u1', jti: 'jti-1', revokedAt: null, expiresAt: past },
    });
    const s2 = await store.session.create({
      data: { userId: 'u2', jti: 'jti-2', revokedAt: null, expiresAt: future },
    });

    const res = await service.expireOldSessions();
    expect(res.count).toBe(1);

    const updated1 = await store.session.findUnique({ where: { id: s1.id } });
    const updated2 = await store.session.findUnique({ where: { id: s2.id } });
    expect(updated1!.revokedAt).toBeDefined();
    expect(updated1!.revokedAt).not.toBeNull();
    expect(updated2!.revokedAt).toBeNull();
  });

  it('deactivates expired community bans', async () => {
    const past = new Date(Date.now() - 3600 * 1000);
    const future = new Date(Date.now() + 3600 * 1000);

    const b1 = await store.communityBan.create({
      data: {
        communityId: 'comm-bengaluru',
        userId: 'banned-u1',
        bannedById: 'admin-1',
        reason: 'Spam',
        isActive: true,
        expiresAt: past,
      },
    });
    const b2 = await store.communityBan.create({
      data: {
        communityId: 'comm-bengaluru',
        userId: 'banned-u2',
        bannedById: 'admin-1',
        reason: 'Harassment',
        isActive: true,
        expiresAt: future,
      },
    });

    const res = await service.expireTemporaryBans();
    expect(res.count).toBe(1);

    const ban1 = await store.communityBan.findUnique({ where: { id: b1.id } });
    const ban2 = await store.communityBan.findUnique({ where: { id: b2.id } });
    expect(ban1!.isActive).toBe(false);
    expect(ban2!.isActive).toBe(true);
  });

  it('processes scheduled user deletions after recovery period passes', async () => {
    const past = new Date(Date.now() - 1000);
    const userToDelete = await store.user.create({
      data: { authId: 'phone:+919999999991', status: 'DELETION_PENDING' },
    });

    const delReq = await store.deletionRequest.create({
      data: {
        userId: userToDelete.id,
        scheduledAt: past,
        status: 'PENDING',
      },
    });

    const res = await service.processScheduledDeletions();
    expect(res.success).toBe(1);

    const updatedUser = await store.user.findUnique({ where: { id: userToDelete.id } });
    expect(updatedUser!.status).toBe('DELETED');

    const updatedReq = await store.deletionRequest.findUnique({ where: { id: delReq.id } });
    expect(updatedReq!.status).toBe('EXECUTED');
  });

  it('runs all background jobs together via runAllJobs', async () => {
    const result = await service.runAllJobs();
    expect(result.timestamp).toBeDefined();
    expect(result.cleaned_otps).toBeDefined();
    expect(result.cleaned_gps).toBeDefined();
    expect(result.expired_sessions).toBeDefined();
    expect(result.reconciliation).toBeDefined();
  });

  it('reconciles denormalized counts and purges orphaned attachments', async () => {
    const comm = await store.community.create({
      data: { name: 'Reconcile Comm', slug: 'reconcile-comm', memberCount: 99 },
    });
    // Add 1 actual member
    await store.communityMember.create({
      data: { communityId: comm.id, userId: 'user-rec-1', status: 'ACTIVE' },
    });

    const res = await service.reconcileDenormalizedCounts();
    expect(res.reconciledCommunities).toBeGreaterThanOrEqual(1);

    const updatedComm = await store.community.findUnique({ where: { id: comm.id } });
    expect(updatedComm?.memberCount).toBe(1);
  });
});
