import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { IdentitiesService } from './identities.service';
import { PrismaService } from '../database/prisma.service';
import { InMemoryPrismaStore } from '../database/in-memory-prisma';

describe('IdentitiesService', () => {
  let service: IdentitiesService;
  let store: InMemoryPrismaStore;

  beforeEach(async () => {
    store = new InMemoryPrismaStore();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdentitiesService,
        { provide: PrismaService, useValue: store },
      ],
    }).compile();
    service = module.get(IdentitiesService);
  });

  it('creates and reuses community-scoped Anonymous #XXXX identity', async () => {
    const user = await store.user.create({ data: { authId: 'phone:+919111111111' } });
    const first = await service.getOrCreateForCommunity(user.id, 'comm-mumbai');
    const second = await service.getOrCreateForCommunity(user.id, 'comm-mumbai');

    expect(first.id).toBe(second.id);
    expect(first.displayCode).toMatch(/^Anonymous #\d{4}$/);

    const otherComm = await service.getOrCreateForCommunity(user.id, 'comm-delhi');
    expect(otherComm.id).not.toBe(first.id);
  });

  it('logs an audit record on private lookup', async () => {
    const admin = await store.user.findUnique({ where: { id: 'user-demo-admin' } });
    expect(admin).toBeTruthy();

    const lookup = await service.privateLookupByIdentityId(
      'ident-demo-1',
      'user-demo-admin',
      'Legal compliance check #42',
      '127.0.0.1',
    );
    expect(lookup.audit_logged).toBe(true);
    expect(lookup.user_id).toBe('user-demo-admin');

    const logs = await store.auditLog.findMany({ where: { action: 'IDENTITY_LOOKUP' } });
    expect(logs.length).toBe(1);
    expect(logs[0].resourceId).toBe('ident-demo-1');
  });

  it('throws NotFoundException for unknown identity lookup', async () => {
    await expect(
      service.privateLookupByIdentityId('missing-id', 'user-demo-admin', 'Check'),
    ).rejects.toThrow(NotFoundException);
  });

  it('retries on P2002 conflict and resolves when identity was created concurrently', async () => {
    const user = await store.user.create({ data: { authId: 'phone:+919222222222' } });
    const originalCreate = store.anonymousIdentity.create.bind(store.anonymousIdentity);
    let attempts = 0;

    jest.spyOn(store.anonymousIdentity, 'create').mockImplementation(async (args: any) => {
      attempts++;
      if (attempts === 1) {
        // Simulate concurrent creation in background
        await originalCreate({
          data: {
            userId: user.id,
            communityId: 'comm-mumbai',
            displayCode: 'Anonymous #1001',
          },
        });
        const err: any = new Error('Unique constraint failed');
        err.code = 'P2002';
        throw err;
      }
      return originalCreate(args);
    });

    const result = await service.getOrCreateForCommunity(user.id, 'comm-mumbai');
    expect(result).toBeDefined();
    expect(result.displayCode).toBe('Anonymous #1001');
    expect(attempts).toBe(1);
  });

  it('throws Error after 10 failed attempts on persistent error', async () => {
    const user = await store.user.create({ data: { authId: 'phone:+919333333333' } });
    jest.spyOn(store.anonymousIdentity, 'create').mockImplementation(async () => {
      const err: any = new Error('Unique constraint failed');
      err.code = 'P2002';
      throw err;
    });

    await expect(
      service.getOrCreateForCommunity(user.id, 'comm-mumbai'),
    ).rejects.toThrow('Failed to create anonymous identity after 10 attempts');
  });

  it('creates and returns a unique global anonymous identity', async () => {
    const user = await store.user.create({ data: { authId: 'phone:+919444444444' } });
    const global1 = await service.getOrCreateGlobal(user.id);
    expect(global1.is_global).toBe(true);
    expect(global1.display_code).toMatch(/^Global #\d{4}$/);

    const global2 = await service.getOrCreateGlobal(user.id);
    expect(global2.id).toBe(global1.id);
  });

  it('changes display code, prevents collisions, and records history', async () => {
    const user = await store.user.create({ data: { authId: 'phone:+919555555555' } });
    const identity = await service.getOrCreateForCommunity(user.id, 'comm-mumbai');

    const changed = await service.changeDisplayCode(
      user.id,
      identity.id,
      'Mystic Wanderer',
      'Wanted a creative pseudonym',
    );
    expect(changed.display_code).toBe('Mystic Wanderer');
    expect(changed.previous_display_code).toBe(identity.displayCode);

    const history = await service.getIdentityHistory(identity.id, user.id);
    expect(history.history.length).toBe(1);
    expect(history.history[0].previous_display_code).toBe(identity.displayCode);
    expect(history.history[0].new_display_code).toBe('Mystic Wanderer');
  });
});

