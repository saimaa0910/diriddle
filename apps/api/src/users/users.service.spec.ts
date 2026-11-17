import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../database/prisma.service';
import { InMemoryPrismaStore } from '../database/in-memory-prisma';
import { IdentitiesService } from '../identities/identities.service';
import { OtpStorageService } from '../auth/otp-storage.service';

describe('UsersService', () => {
  let service: UsersService;
  let store: InMemoryPrismaStore;
  let otpStorage: OtpStorageService;

  beforeEach(async () => {
    store = new InMemoryPrismaStore();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        IdentitiesService,
        OtpStorageService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: string) => fallback ?? '30',
          },
        },
        { provide: PrismaService, useValue: store },
      ],
    }).compile();

    service = module.get(UsersService);
    otpStorage = module.get(OtpStorageService);
  });

  it('deletes account and scrubs user posts, comments, device tokens and user record', async () => {
    const user = await store.user.create({
      data: {
        authId: 'phone:+919876543210',
        status: 'ACTIVE',
      },
    });

    const post = await store.post.create({
      data: {
        userId: user.id,
        communityId: 'comm-bengaluru',
        content: 'Post by user to delete',
        status: 'PUBLISHED',
      },
    });

    const comment = await store.comment.create({
      data: {
        postId: post.id,
        userId: user.id,
        content: 'Comment by user to delete',
        status: 'ACTIVE',
      },
    });

    await store.deviceToken.create({
      data: {
        userId: user.id,
        token: 'device-token-123',
        platform: 'android',
      },
    });

    const res = await service.deleteAccount(user.id, 'User requested account closure');
    expect(res.deleted).toBe(true);
    expect(res.deleted_at).toBeDefined();

    // Check user record
    const updatedUser = await store.user.findUnique({ where: { id: user.id } });
    expect(updatedUser?.status).toBe('DELETED');
    expect(updatedUser?.deletedAt).toBeDefined();

    // Check post record
    const updatedPost = await store.post.findUnique({ where: { id: post.id } });
    expect(updatedPost?.status).toBe('REMOVED');

    // Check comment record
    const updatedComment = await store.comment.findUnique({ where: { id: comment.id } });
    expect(updatedComment?.status).toBe('REMOVED');

    // Check device token removed
    const tokens = await store.deviceToken.findMany({ where: { userId: user.id } });
    expect(tokens).toHaveLength(0);
  });

  it('manages private profile details without exposing them publicly', async () => {
    const user = await store.user.create({ data: { authId: 'phone:+919876543211' } });

    const updated = await service.updateProfile(user.id, {
      display_name: 'Rohit K',
      interests: ['music', 'tech'],
      preferred_language: 'en',
    });
    expect(updated.display_name).toBe('Rohit K');
    expect(updated.interests).toContain('music');

    const profile = await service.getProfile(user.id);
    expect(profile.profile?.display_name).toBe('Rohit K');
  });

  it('handles account lifecycle: deactivation and reactivation', async () => {
    const user = await store.user.create({ data: { authId: 'phone:+919876543212', status: 'ACTIVE' } });

    const deact = await service.deactivateAccount(user.id);
    expect(deact.deactivated).toBe(true);

    const check1 = await store.user.findUnique({ where: { id: user.id } });
    expect(check1?.status).toBe('DEACTIVATED');

    const react = await service.reactivateAccount(user.id);
    expect(react.reactivated).toBe(true);

    const check2 = await store.user.findUnique({ where: { id: user.id } });
    expect(check2?.status).toBe('ACTIVE');
  });

  it('handles deletion request with holding period and cancellation', async () => {
    const user = await store.user.create({ data: { authId: 'phone:+919876543213', status: 'ACTIVE' } });

    const req = await service.requestDeletion(user.id, 'Taking a break');
    expect(req.status).toBe('DELETION_PENDING');
    expect(req.recovery_days).toBe(30);

    const status1 = await service.getDeletionStatus(user.id);
    expect(status1.has_pending_deletion).toBe(true);

    const cancel = await service.cancelDeletion(user.id);
    expect(cancel.cancellation_successful).toBe(true);

    const status2 = await service.getDeletionStatus(user.id);
    expect(status2.has_pending_deletion).toBe(false);
  });

  describe('Contact Change Workflow', () => {
    it('requests OTP and verifies changing phone contact number', async () => {
      const user = await store.user.create({
        data: { authId: 'phone:+919800001111', status: 'ACTIVE' },
      });

      const reqRes = await service.requestContactChange(user.id, '+919800002222', 'phone');
      expect(reqRes.success).toBe(true);

      // Verify OTP (using dev bypass in test environment)
      const verifyRes = await service.verifyContactChange(
        user.id,
        '+919800002222',
        '123456',
        'phone',
      );
      expect(verifyRes.success).toBe(true);
      expect(verifyRes.new_contact).toBe('+919800002222');

      const updatedUser = await store.user.findUnique({ where: { id: user.id } });
      expect(updatedUser?.authId).toBe('phone:+919800002222');
    });

    it('rejects contact change if new identifier is already used by another active account', async () => {
      const user1 = await store.user.create({
        data: { authId: 'phone:+919800003333', status: 'ACTIVE' },
      });
      await store.user.create({
        data: { authId: 'phone:+919800004444', status: 'ACTIVE' },
      });

      await expect(
        service.requestContactChange(user1.id, '+919800004444', 'phone'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
