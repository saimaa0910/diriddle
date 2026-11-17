import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { ModerationService } from '../moderation/moderation.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';
import { InMemoryPrismaStore } from '../database/in-memory-prisma';

describe('AdminService', () => {
  let service: AdminService;
  let store: InMemoryPrismaStore;
  let authServiceMock: Partial<AuthService>;

  beforeEach(async () => {
    store = new InMemoryPrismaStore();
    authServiceMock = {
      issueTokens: jest.fn().mockResolvedValue({
        access_token: 'mock-admin-access-token',
        refresh_token: 'mock-admin-refresh-token',
        token_type: 'Bearer',
        expires_in: 900,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        ModerationService,
        { provide: PrismaService, useValue: store },
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  describe('getReports (anonymity preservation)', () => {
    it('strips reporter_id when requester is not SUPER_ADMIN', async () => {
      const reporter = await store.user.create({ data: { authId: 'phone:+919000000001' } });
      await store.report.create({
        data: {
          reporterId: reporter.id,
          targetType: 'POST',
          targetId: 'post-demo-1',
          reason: 'HARASSMENT',
          description: 'Harassing content',
          status: 'RECEIVED',
          priority: 'HIGH',
        },
      });

      const moderatorRequester = {
        id: 'mod-1',
        authId: 'phone:+919000000002',
        status: 'ACTIVE',
        ageVerified: true,
        adminRole: { role: 'MODERATOR' },
      };

      const result = await service.getReports({}, moderatorRequester as any);
      expect(result.data.length).toBeGreaterThan(0);
      const found = result.data.find((r) => r.target_id === 'post-demo-1');
      expect(found).toBeDefined();
      expect(found?.reporter_id).toBeNull();
    });

    it('exposes reporter_id when requester is SUPER_ADMIN', async () => {
      const reporter = await store.user.create({ data: { authId: 'phone:+919000000003' } });
      await store.report.create({
        data: {
          reporterId: reporter.id,
          targetType: 'POST',
          targetId: 'post-demo-1',
          reason: 'SPAM',
          description: 'Spam post',
          status: 'RECEIVED',
          priority: 'MEDIUM',
        },
      });

      const superAdminRequester = {
        id: 'super-1',
        authId: 'phone:+919000000004',
        status: 'ACTIVE',
        ageVerified: true,
        adminRole: { role: 'SUPER_ADMIN' },
      };

      const result = await service.getReports({}, superAdminRequester as any);
      const found = result.data.find((r) => r.reporter_id === reporter.id);
      expect(found).toBeDefined();
      expect(found?.reporter_id).toBe(reporter.id);
    });
  });

  describe('adminLogin', () => {
    it('successfully logs in seeded demo admin and returns tokens with admin role', async () => {
      const result = await service.adminLogin({
        identifier: '+919876543210',
      });

      expect(result.access_token).toBe('mock-admin-access-token');
      expect(result.refresh_token).toBe('mock-admin-refresh-token');
      expect(result.token_type).toBe('Bearer');
      expect(result.expires_in).toBe(900);
      expect(result.admin.role).toBe('SUPER_ADMIN');
      expect(result.admin.id).toBe('user-demo-admin');
    });

    it('rejects user without admin role', async () => {
      const regularUser = await store.user.create({
        data: { authId: 'phone:+919123456789' },
      });

      await expect(
        service.adminLogin({ identifier: regularUser.authId }),
      ).rejects.toMatchObject({
        response: {
          error: 'INVALID_ADMIN_CREDENTIALS',
          message: 'Invalid administrative credentials or expired role',
        },
      });
    });

    it('rejects admin with expired admin role', async () => {
      const expiredAdmin = await store.user.create({
        data: { authId: 'phone:+919123456780' },
      });
      await store.adminRole.create({
        data: {
          userId: expiredAdmin.id,
          role: 'MODERATOR',
          expiresAt: new Date(Date.now() - 60000),
        },
      });

      await expect(
        service.adminLogin({ identifier: expiredAdmin.authId }),
      ).rejects.toMatchObject({
        response: {
          error: 'INVALID_ADMIN_CREDENTIALS',
          message: 'Invalid administrative credentials or expired role',
        },
      });
    });

    it('rejects empty login credentials', async () => {
      await expect(service.adminLogin({})).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getOverview', () => {
    it('returns aligned shape with kpis including total_users, total_posts, total_reports, pending_reports, dau and top-level dau', async () => {
      const overview = await service.getOverview();

      expect(overview.dau).toBeDefined();
      expect(overview.kpis).toBeDefined();
      expect(overview.kpis.total_users).toBeGreaterThanOrEqual(1);
      expect(overview.kpis.total_posts).toBeGreaterThanOrEqual(1);
      expect(overview.kpis.total_reports).toBeDefined();
      expect(overview.kpis.pending_reports).toBeDefined();
      expect(overview.kpis.dau).toBe(overview.dau);
      expect(overview.kpis.active_cities).toBeDefined();
      expect(Array.isArray(overview.priority_reports)).toBe(true);
    });
  });

  describe('community management', () => {
    it('creates community with ACTIVE status and writes audit log', async () => {
      const comm = await service.createCommunity('user-demo-admin', {
        name: 'Koramangala Techies',
        type: 'INTEREST' as any,
        city: 'Bengaluru',
        state: 'Karnataka',
      });

      expect(comm.id).toBeDefined();
      expect(comm.name).toBe('Koramangala Techies');
      expect(comm.slug).toBe('koramangala-techies');
      expect(comm.status).toBe('ACTIVE');

      const auditLogs = await store.auditLog.findMany({
        where: { resourceId: comm.id, action: 'ADMIN_COMMUNITY_CREATE' },
      });
      expect(auditLogs.length).toBe(1);
    });
  });

  describe('status updates', () => {
    it('updates post status and writes audit log', async () => {
      const res = await service.updatePostStatus('user-demo-admin', 'post-demo-1', 'REMOVED');
      expect(res.status).toBe('REMOVED');

      const post = await store.post.findUnique({ where: { id: 'post-demo-1' } });
      expect(post?.status).toBe('REMOVED');

      const logs = await store.auditLog.findMany({
        where: { resourceId: 'post-demo-1', action: 'ADMIN_POST_STATUS_UPDATE' },
      });
      expect(logs.length).toBe(1);
    });

    it('throws NotFoundException when post does not exist', async () => {
      await expect(
        service.updatePostStatus('user-demo-admin', 'non-existent', 'REMOVED'),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates comment status and writes audit log', async () => {
      const comment = await store.comment.create({
        data: {
          userId: 'user-demo-admin',
          postId: 'post-demo-1',
          content: 'Test comment to update',
        },
      });

      const res = await service.updateCommentStatus('user-demo-admin', comment.id, 'FLAGGED');
      expect(res.status).toBe('FLAGGED');

      const updated = await store.comment.findUnique({ where: { id: comment.id } });
      expect(updated?.status).toBe('FLAGGED');
    });

    it('throws NotFoundException when comment does not exist', async () => {
      await expect(
        service.updateCommentStatus('user-demo-admin', 'non-existent', 'FLAGGED'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('handleModerationAction', () => {
    it('executes action on report target', async () => {
      const report = await store.report.create({
        data: {
          reporterId: 'user-demo-admin',
          targetType: 'POST',
          targetId: 'post-demo-1',
          reason: 'HARASSMENT',
          status: 'RECEIVED',
          priority: 'HIGH',
        },
      });

      const result = await service.handleModerationAction('user-demo-admin', report.id, {
        action_type: 'REMOVE' as any,
        reason: 'Confirmed hate speech',
      });

      expect(result.action_type).toBe('REMOVE');
      const post = await store.post.findUnique({ where: { id: 'post-demo-1' } });
      expect(post?.status).toBe('REMOVED');

      const updatedReport = await store.report.findUnique({ where: { id: report.id } });
      expect(updatedReport?.status).toBe('RESOLVED');
    });
  });

  describe('User lifecycle and administrative role governance', () => {
    it('suspending a user immediately invalidates all active sessions', async () => {
      const user = await store.user.create({ data: { authId: 'phone:+919888888888', status: 'ACTIVE' } });
      const s1 = await store.session.create({
        data: { userId: user.id, jti: 'jti-s1', revokedAt: null, expiresAt: new Date(Date.now() + 3600000) },
      });

      await service.updateUserStatus('user-demo-admin', user.id, 'SUSPENDED', 'Terms violation');

      const updatedSession = await store.session.findUnique({ where: { id: s1.id } });
      expect(updatedSession?.revokedAt).toBeDefined();
      expect(updatedSession?.revokedAt).not.toBeNull();
    });

    it('grants and revokes admin roles with super admin enforcement', async () => {
      const targetUser = await store.user.create({ data: { authId: 'phone:+919777777771' } });

      const granted = await service.grantAdminRole('user-demo-admin', targetUser.id, 'MODERATOR');
      expect(granted.role).toBe('MODERATOR');

      const roleInDb = await store.adminRole.findUnique({ where: { userId: targetUser.id } });
      expect(roleInDb?.role).toBe('MODERATOR');

      await service.revokeAdminRole('user-demo-admin', targetUser.id);
      const revokedInDb = await store.adminRole.findUnique({ where: { userId: targetUser.id } });
      expect(revokedInDb).toBeNull();
    });

    it('assigns reports and generates detailed operational health status', async () => {
      const report = await store.report.create({
        data: {
          reporterId: 'user-demo-admin',
          targetType: 'POST',
          targetId: 'post-demo-1',
          reason: 'SPAM',
          status: 'RECEIVED',
        },
      });

      const assigned = await service.assignReport('user-demo-admin', report.id);
      expect(assigned.status).toBe('UNDER_REVIEW');

      const health = await service.getDetailedHealth();
      expect(health.status).toBe('UP');
      expect(health.metrics.total_users).toBeGreaterThan(0);
      expect(health.database.connected).toBe(true);
    });

    it('applies and releases legal hold on user accounts', async () => {
      const targetUser = await store.user.create({ data: { authId: 'phone:+919777777772' } });

      const applied = await service.setLegalHold('user-demo-admin', targetUser.id, true, 'Court subpoena #401');
      expect(applied.legal_hold).toBe(true);

      const released = await service.setLegalHold('user-demo-admin', targetUser.id, false, 'Hold expired');
      expect(released.legal_hold).toBe(false);
    });

    it('rolls back an administrative action to its prior snapshot', async () => {
      const targetUser = await store.user.create({ data: { authId: 'phone:+919777777773', status: 'ACTIVE' } });

      // Suspend user (creates audit log with beforeState: { status: 'ACTIVE' })
      await service.updateUserStatus('user-demo-admin', targetUser.id, 'SUSPENDED', 'Temporary ban');

      const logs = await service.getAuditLogs();
      const statusLog = logs.data.find((l: any) => l.action === 'ADMIN_USER_STATUS_UPDATE' && l.resource_id === targetUser.id);
      expect(statusLog).toBeTruthy();

      // Rollback suspension
      const rollback = await service.rollbackAuditAction('user-demo-admin', statusLog!.id);
      expect(rollback.rolled_back).toBe(true);

      const restoredUser = await store.user.findUnique({ where: { id: targetUser.id } });
      expect(restoredUser?.status).toBe('ACTIVE');
    });
  });
});
