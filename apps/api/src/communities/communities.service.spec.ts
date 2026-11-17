import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CommunityType } from '@prisma/client';
import { CommunitiesService } from './communities.service';
import { BlocksService } from '../blocks/blocks.service';
import { PrismaService } from '../database/prisma.service';
import { InMemoryPrismaStore } from '../database/in-memory-prisma';

describe('CommunitiesService', () => {
  let service: CommunitiesService;
  let store: InMemoryPrismaStore;

  beforeEach(async () => {
    store = new InMemoryPrismaStore();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunitiesService,
        BlocksService,
        { provide: PrismaService, useValue: store },
      ],
    }).compile();

    service = module.get(CommunitiesService);
  });

  it('creates a new community and assigns owner role and active membership', async () => {
    const user = await store.user.create({ data: { authId: 'phone:+919100000001' } });

    const comm = await service.create(user.id, {
      name: 'Indiranagar Book Club',
      type: CommunityType.NEIGHBORHOOD,
      city: 'Bengaluru',
      description: 'Weekly weekend reads in Indiranagar',
    });

    expect(comm.id).toBeDefined();
    expect(comm.is_owner).toBe(true);
    expect(comm.slug).toBe('indiranagar-book-club');

    const detail = await service.findOne(comm.id, user.id);
    expect(detail.is_owner).toBe(true);
    expect(detail.role).toBe('OWNER');
    expect(detail.is_member).toBe(true);
  });

  it('transfers community ownership to an active member', async () => {
    const owner = await store.user.create({ data: { authId: 'phone:+919100000002' } });
    const member = await store.user.create({ data: { authId: 'phone:+919100000003' } });

    const comm = await service.create(owner.id, {
      name: 'Tech Founders Koramangala',
      type: CommunityType.NEIGHBORHOOD,
      city: 'Bengaluru',
    });

    // Member joins
    await service.join(comm.id, member.id);

    // Transfer ownership
    const transfer = await service.transferOwnership(comm.id, owner.id, member.id);
    expect(transfer.success).toBe(true);

    const updated = await service.findOne(comm.id, member.id);
    expect(updated.is_owner).toBe(true);
  });

  it('handles private communities with join request and approval workflow', async () => {
    const owner = await store.user.create({ data: { authId: 'phone:+919100000004' } });
    const applicant = await store.user.create({ data: { authId: 'phone:+919100000005' } });

    const privateComm = await service.create(owner.id, {
      name: 'Private Investors Club',
      type: CommunityType.SPECIAL,
      is_private: true,
    });

    // Applicant requests to join
    const reqRes = await service.join(privateComm.id, applicant.id, 'Angel investor in BLR');
    expect(reqRes.status).toBe('REQUESTED');

    // List pending join requests
    const list = await service.listJoinRequests(privateComm.id, owner.id);
    expect(list.data.length).toBe(1);

    // Owner approves request
    const approved = await service.approveJoinRequest(privateComm.id, owner.id, list.data[0].id);
    expect(approved.approved).toBe(true);

    // Verify applicant is now an active member
    const detail = await service.findOne(privateComm.id, applicant.id);
    expect(detail.is_member).toBe(true);
  });

  it('manages community rules and enforcement', async () => {
    const owner = await store.user.create({ data: { authId: 'phone:+919100000006' } });
    const comm = await service.create(owner.id, {
      name: 'Photography Enthusiasts',
      type: CommunityType.SPECIAL,
    });

    const rule = await service.createRule(comm.id, owner.id, {
      title: 'No watermarked promotional images',
      description: 'Keep posts authentic and non-commercial',
    });
    expect(rule.title).toBe('No watermarked promotional images');

    const rules = await service.listRules(comm.id);
    expect(rules.data.length).toBe(1);

    const deleted = await service.deleteRule(comm.id, owner.id, rule.id);
    expect(deleted.deleted).toBe(true);
  });

  it('enforces community bans: banned user cannot rejoin', async () => {
    const owner = await store.user.create({ data: { authId: 'phone:+919100000007' } });
    const troublemaker = await store.user.create({ data: { authId: 'phone:+919100000008' } });

    const comm = await service.create(owner.id, {
      name: 'Bengaluru Nightlife',
      type: CommunityType.CITY,
    });

    await service.join(comm.id, troublemaker.id);

    // Ban the user
    const ban = await service.banMember(comm.id, owner.id, troublemaker.id, {
      reason: 'Repeated spam violation',
    });
    expect(ban.banned).toBe(true);

    // Attempt to rejoin should be rejected
    await expect(service.join(comm.id, troublemaker.id)).rejects.toThrow(ForbiddenException);

    // Unban the user
    const unban = await service.unbanMember(comm.id, owner.id, troublemaker.id);
    expect(unban.unbanned).toBe(true);
  });
});
