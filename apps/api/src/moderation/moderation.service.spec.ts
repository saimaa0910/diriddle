import { Test, TestingModule } from '@nestjs/testing';
import { ModerationActionType } from '@prisma/client';
import { ModerationService } from './moderation.service';
import { PrismaService } from '../database/prisma.service';
import { InMemoryPrismaStore } from '../database/in-memory-prisma';

describe('ModerationService', () => {
  let service: ModerationService;
  let store: InMemoryPrismaStore;

  beforeEach(async () => {
    store = new InMemoryPrismaStore();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        { provide: PrismaService, useValue: store },
      ],
    }).compile();

    service = module.get(ModerationService);
  });

  it('allows clean content to publish immediately', () => {
    const result = service.checkContentSafety('Best filter coffee spot in Indiranagar?');
    expect(result.allowed).toBe(true);
    expect(result.action).toBe('PUBLISH');
  });

  it('flags phone numbers and emails for review', () => {
    const result = service.checkContentSafety('Contact me at test@example.com or 9876543210');
    expect(result.action).toBe('HOLD_FOR_REVIEW');
    expect(result.detectedPatterns).toContain('EMAIL');
    expect(result.detectedPatterns).toContain('PHONE_NUMBER');
  });

  it('rejects Aadhaar/PAN patterns automatically', () => {
    const result = service.checkContentSafety('PAN ABCDE1234F leaked');
    expect(result.allowed).toBe(false);
    expect(result.action).toBe('REJECT');
    expect(result.detectedPatterns).toContain('PAN_NUMBER');
  });

  it('executes REMOVE moderation action and writes immutable audit log', async () => {
    const action = await service.takeAction('user-demo-admin', {
      target_type: 'POST',
      target_id: 'post-demo-1',
      action_type: ModerationActionType.REMOVE,
      reason: 'Confirmed policy violation',
    });
    expect(action.action_type).toBe(ModerationActionType.REMOVE);

    const post = await store.post.findUnique({ where: { id: 'post-demo-1' } });
    expect(post?.status).toBe('REMOVED');

    const logs = await store.auditLog.findMany({ where: { resourceId: 'post-demo-1' } });
    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe('MODERATION_REMOVE');
  });
});
