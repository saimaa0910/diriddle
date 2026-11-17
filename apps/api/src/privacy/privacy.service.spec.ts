import { Test, TestingModule } from '@nestjs/testing';
import { PrivacyService } from './privacy.service';
import { PrismaService } from '../database/prisma.service';
import { InMemoryPrismaStore } from '../database/in-memory-prisma';

describe('PrivacyService', () => {
  let service: PrivacyService;
  let store: InMemoryPrismaStore;

  beforeEach(async () => {
    store = new InMemoryPrismaStore();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrivacyService,
        { provide: PrismaService, useValue: store },
      ],
    }).compile();

    service = module.get(PrivacyService);
  });

  it('records consent events and returns consent history', async () => {
    const user = await store.user.create({ data: { authId: 'phone:+919111111111' } });

    await service.recordConsent(user.id, {
      consent_type: 'TERMS_OF_SERVICE',
      version: 'v2.0',
      granted: true,
      ip_address: '127.0.0.1',
    });

    await service.recordConsent(user.id, {
      consent_type: 'LOCATION_DATA',
      version: 'v1.0',
      granted: false,
    });

    const history = await service.getConsentHistory(user.id);
    expect(history.data).toHaveLength(2);
    const loc = history.data.find((h) => h.consent_type === 'LOCATION_DATA');
    expect(loc).toBeDefined();
    expect(loc?.granted).toBe(false);
  });

  it('retrieves retention policies with standard defaults', async () => {
    const policies = await service.getRetentionPolicies();
    expect(policies.data.length).toBeGreaterThan(0);
    expect(policies.data.some((p: any) => p.data_type === 'EPHEMERAL_GPS')).toBe(true);
  });

  it('logs restricted identity resolution audits', async () => {
    const log = await service.logIdentityAccess(
      'user-admin-1',
      'ident-1234',
      'LEGAL_SUBPOENA_INQUIRY',
      '192.168.1.5',
    );
    expect(log.id).toBeDefined();
    expect(log.identity_id).toBe('ident-1234');
  });

  it('generates a complete GDPR export envelope', async () => {
    const user = await store.user.create({ data: { authId: 'phone:+919222222222' } });
    await store.userProfile.create({
      data: {
        userId: user.id,
        displayName: 'Test Subject',
        preferredLanguage: 'hi',
      },
    });
    await store.post.create({
      data: {
        userId: user.id,
        communityId: 'comm-bengaluru',
        content: 'Post in export',
        category: 'STORY',
        anonymousIdentityId: 'ident-demo-1',
      },
    });

    const exportData = await service.exportUserData(user.id);
    expect(exportData.export_version).toBe('2.0');
    expect(exportData.account.status).toBe('ACTIVE');
    expect(exportData.profile?.display_name).toBe('Test Subject');
    expect(exportData.content.posts).toHaveLength(1);
    expect(exportData.content.posts[0].content).toBe('Post in export');
  });
});
