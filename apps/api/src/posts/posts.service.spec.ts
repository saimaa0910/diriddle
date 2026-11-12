import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PostCategory, Visibility } from '@prisma/client';
import { PostsService } from './posts.service';
import { PrismaService } from '../database/prisma.service';
import { InMemoryPrismaStore } from '../database/in-memory-prisma';
import { IdentitiesService } from '../identities/identities.service';
import { ModerationService } from '../moderation/moderation.service';
import { ReactionsService } from '../reactions/reactions.service';
import { CommunityGateway } from '../realtime/community.gateway';
import { NotificationsService } from '../notifications/notifications.service';

describe('PostsService', () => {
  let service: PostsService;
  let store: InMemoryPrismaStore;

  beforeEach(async () => {
    store = new InMemoryPrismaStore();
    const mockGateway = {
      broadcastPostCreated: jest.fn(),
      broadcastCommentCreated: jest.fn(),
      broadcastReactionUpdated: jest.fn(),
      sendNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        IdentitiesService,
        ModerationService,
        ReactionsService,
        NotificationsService,
        { provide: PrismaService, useValue: store },
        { provide: CommunityGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get(PostsService);
  });

  it('creates an anonymous post and honors idempotency key', async () => {
    const dto = {
      community_id: 'comm-bengaluru',
      category: PostCategory.CONFESSION,
      content: 'Traffic at Silk Board taught me patience today.',
      visibility: Visibility.COMMUNITY,
    };

    const first = await service.create(dto, 'user-demo-admin', 'idem-key-1');
    const second = await service.create(dto, 'user-demo-admin', 'idem-key-1');

    expect(first.id).toBe(second.id);
    expect(first.anonymous_name).toMatch(/^Anonymous #\d{4}$/);
    expect(first.status).toBe('PUBLISHED');
  });

  it('holds posts containing phone numbers for moderation review', async () => {
    const res = await service.create(
      {
        community_id: 'comm-mumbai',
        category: PostCategory.LOCAL_ALERT,
        content: 'Reach out to 9876543210 for lost wallet',
      },
      'user-demo-admin',
    );
    expect(res.status).toBe('UNDER_REVIEW');
  });

  it('rejects posts containing Aadhaar-like 12-digit PII', async () => {
    await expect(
      service.create(
        {
          community_id: 'comm-delhi',
          category: PostCategory.RANT,
          content: 'My number is 1234 5678 9012',
        },
        'user-demo-admin',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('forbids deleting another user post', async () => {
    const otherUser = await store.user.create({ data: { authId: 'phone:+919222222222' } });
    await expect(service.remove('post-demo-1', otherUser.id)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
