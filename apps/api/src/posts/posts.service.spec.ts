import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PostCategory, Visibility } from '@prisma/client';
import { PostsService } from './posts.service';
import { HashtagService } from './hashtag.service';
import { MentionService } from './mention.service';
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
        HashtagService,
        MentionService,
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

  it('creates post with poll atomically and includes poll in response', async () => {
    const res = await service.create(
      {
        community_id: 'comm-bengaluru',
        category: PostCategory.POLL,
        content: 'Favorite weekend hangout?',
        visibility: Visibility.COMMUNITY,
        poll: {
          question: 'Where do you prefer?',
          options: ['Indiranagar', 'Koramangala', 'HSR Layout'],
          closes_in_hours: 48,
        },
      },
      'user-demo-admin',
    );

    expect(res.id).toBeDefined();
    expect(res.poll).toBeDefined();
    expect(res.poll.question).toBe('Where do you prefer?');
    expect(res.poll.options).toHaveLength(3);
    expect(res.poll.options[0].optionText).toBe('Indiranagar');
  });

  it('creates draft post and publishes it', async () => {
    const draft = await service.create(
      {
        community_id: 'comm-bengaluru',
        category: PostCategory.STORY,
        content: 'Draft content for later',
        is_draft: true,
      },
      'user-demo-admin',
    );

    expect(draft.is_draft).toBe(true);
    expect(draft.status).toBe('DRAFT');

    const published = await service.publishDraft(draft.id, 'user-demo-admin');
    expect(published.is_draft).toBe(false);
    expect(published.status).toBe('PUBLISHED');
  });

  it('creates post with SELECTED_COMMUNITIES audience mapping', async () => {
    const res = await service.create(
      {
        community_id: 'comm-bengaluru',
        category: PostCategory.NEIGHBORHOOD,
        content: 'Inter-neighborhood update',
        visibility: Visibility.SELECTED_COMMUNITIES,
        audience_community_ids: ['comm-mumbai', 'comm-delhi'],
      },
      'user-demo-admin',
    );

    expect(res.id).toBeDefined();
    const audiences = await store.postAudience.findMany({ where: { postId: res.id } });
    expect(audiences).toHaveLength(2);
  });

  it('extracts hashtags and indexes them properly', async () => {
    const res = await service.create(
      {
        community_id: 'comm-bengaluru',
        category: PostCategory.CONFESSION,
        content: 'Exploring #tech and #startup trends in Bengaluru #tech!',
      },
      'user-demo-admin',
    );

    const postHashtags = await store.postHashtag.findMany({ where: { postId: res.id } });
    expect(postHashtags.length).toBeGreaterThanOrEqual(2);
  });

  it('pins and unpins post if user is community staff', async () => {
    // comm-bengaluru owner is user-demo-admin in seed
    const pinned = await service.pinPost('post-demo-1', 'user-demo-admin');
    expect(pinned.is_pinned).toBe(true);

    const unpinned = await service.unpinPost('post-demo-1', 'user-demo-admin');
    expect(unpinned.is_pinned).toBe(false);

    // Non-staff user cannot pin
    const otherUser = await store.user.create({ data: { authId: 'phone:+919333333333' } });
    await expect(service.pinPost('post-demo-1', otherUser.id)).rejects.toThrow(ForbiddenException);
  });

  it('updates post content and prevents updating with PII', async () => {
    const post = await service.create(
      {
        community_id: 'comm-bengaluru',
        category: PostCategory.RANT,
        content: 'Original rant content',
      },
      'user-demo-admin',
    );

    const updated = await service.update(post.id, 'user-demo-admin', {
      content: 'Updated rant content #newtag',
    });
    expect(updated.content).toBe('Updated rant content #newtag');

    // Attempting update with Aadhaar-like PII fails
    await expect(
      service.update(post.id, 'user-demo-admin', {
        content: 'Aadhaar 1234 5678 9012 update',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows author to hide and unhide a post', async () => {
    const post = await service.create(
      {
        community_id: 'comm-bengaluru',
        category: PostCategory.CONFESSION,
        content: 'Post to be hidden and unhidden',
      },
      'user-demo-admin',
    );

    const hidden = await service.hidePost(post.id, 'user-demo-admin');
    expect(hidden.status).toBe('HIDDEN');
    expect(hidden.hidden).toBe(true);

    const unhidden = await service.unhidePost(post.id, 'user-demo-admin');
    expect(unhidden.status).toBe('PUBLISHED');
    expect(unhidden.hidden).toBe(false);
  });

  it('generates share metadata for accessible post', async () => {
    const post = await service.create(
      {
        community_id: 'comm-bengaluru',
        category: PostCategory.STORY,
        content: 'Check this out #viral',
      },
      'user-demo-admin',
    );

    const share = await service.sharePost(post.id, 'user-demo-admin');
    expect(share.post_id).toBe(post.id);
    expect(share.share_url).toBe(`/posts/${post.id}`);
    expect(share.shareable).toBe(true);
  });
});

