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
});
