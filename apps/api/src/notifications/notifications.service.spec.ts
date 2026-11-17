import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../database/prisma.service';
import { InMemoryPrismaStore } from '../database/in-memory-prisma';
import { CommunityGateway } from '../realtime/community.gateway';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let store: InMemoryPrismaStore;

  beforeEach(async () => {
    store = new InMemoryPrismaStore();
    const mockGateway = {
      sendNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: store },
        { provide: CommunityGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  it('lists all notifications for user with findAll', async () => {
    await store.notification.create({
      data: {
        userId: 'user-notif-1',
        type: NotificationType.COMMENT_REPLY,
        referenceId: 'post-1',
        payload: { msg: 'Hello' },
      },
    });

    const list = await service.findAll('user-notif-1');
    expect(list).toHaveLength(1);
    expect(list[0].userId).toBe('user-notif-1');
  });

  it('calculates unread notifications count', async () => {
    await store.notification.create({
      data: {
        userId: 'user-notif-2',
        type: NotificationType.REACTION,
        referenceId: 'post-2',
        payload: {},
        readAt: null,
      },
    });
    await store.notification.create({
      data: {
        userId: 'user-notif-2',
        type: NotificationType.COMMUNITY_POST,
        referenceId: 'post-3',
        payload: {},
        readAt: new Date(),
      },
    });

    const unreadCount = await service.getUnreadCount('user-notif-2');
    expect(unreadCount).toBe(1);
  });

  it('marks a notification as read when user owns it', async () => {
    const notif = await store.notification.create({
      data: {
        userId: 'user-notif-3',
        type: NotificationType.COMMENT_REPLY,
        referenceId: 'post-1',
        payload: {},
        readAt: null,
      },
    });

    const result = await service.markRead(notif.id, 'user-notif-3');
    expect(result.id).toBe(notif.id);
    expect(result.read_at).toBeDefined();

    const updated = await store.notification.findUnique({ where: { id: notif.id } });
    expect(updated?.readAt).toBeDefined();
  });

  it('throws NotFoundException when marking a notification owned by another user', async () => {
    const notif = await store.notification.create({
      data: {
        userId: 'user-notif-owner',
        type: NotificationType.COMMENT_REPLY,
        referenceId: 'post-1',
        payload: {},
      },
    });

    await expect(service.markRead(notif.id, 'user-notif-imposter')).rejects.toThrow(
      NotFoundException,
    );
  });
});
