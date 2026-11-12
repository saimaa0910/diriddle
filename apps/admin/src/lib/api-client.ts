'use client';

import axios, { AxiosError } from 'axios';
import {
  INITIAL_DEMO_APPEALS,
  INITIAL_DEMO_AUDIT_LOGS,
  INITIAL_DEMO_COMMUNITIES,
  INITIAL_DEMO_COMMENTS,
  INITIAL_DEMO_POSTS,
  INITIAL_DEMO_REPORTS,
  INITIAL_DEMO_USERS,
  DEMO_ANALYTICS_OVERVIEW,
} from './demo-data';
import {
  AdminCommunity,
  AdminComment,
  AdminPost,
  AdminReport,
  AdminRole,
  AdminSession,
  AdminUser,
  AnalyticsOverview,
  AppealStatus,
  AuditLogEntry,
  CommentStatus,
  CommunityStatusValue,
  CommunityType,
  ModerationActionType,
  ModerationAppeal,
  ModerationDecisionPayload,
  PostStatus,
  ReportStatus,
  UserStatus,
} from './types';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

const SESSION_STORAGE_KEY = 'diriddle_admin_session';

export const httpClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 4500,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function getStoredAdminSession(): AdminSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AdminSession;
  } catch {
    return null;
  }
}

export function setStoredAdminSession(session: AdminSession | null): void {
  if (typeof window === 'undefined') return;
  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

httpClient.interceptors.request.use((config) => {
  const session = getStoredAdminSession();
  if (session?.token) {
    config.headers.Authorization = `Bearer ${session.token}`;
  }
  return config;
});

type ConnectionListener = (isDemoMode: boolean) => void;

class DemoStateStore {
  isDemoMode = false;
  lastCheckedAt: string | null = null;
  listeners = new Set<ConnectionListener>();

  reports: AdminReport[] = [...INITIAL_DEMO_REPORTS];
  posts: AdminPost[] = [...INITIAL_DEMO_POSTS];
  comments: AdminComment[] = [...INITIAL_DEMO_COMMENTS];
  users: AdminUser[] = [...INITIAL_DEMO_USERS];
  communities: AdminCommunity[] = [...INITIAL_DEMO_COMMUNITIES];
  appeals: ModerationAppeal[] = [...INITIAL_DEMO_APPEALS];
  auditLogs: AuditLogEntry[] = [...INITIAL_DEMO_AUDIT_LOGS];

  setDemoMode(value: boolean) {
    this.lastCheckedAt = new Date().toISOString();
    if (this.isDemoMode !== value) {
      this.isDemoMode = value;
      this.listeners.forEach((listener) => listener(value));
    }
  }

  subscribe(listener: ConnectionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  appendAuditLog(entry: {
    action: string;
    resourceType: string;
    resourceId: string;
    beforeState: Record<string, unknown> | null;
    afterState: Record<string, unknown> | null;
    reason: string;
  }) {
    const session = getStoredAdminSession();
    const nextSeq = (this.auditLogs[0]?.seq ?? 1000) + 1;
    const newLog: AuditLogEntry = {
      id: `aud_${nextSeq}`,
      seq: nextSeq,
      actorAnonId: session?.adminId ?? 'admin_console',
      actorRole: session?.role ?? 'MODERATOR',
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      beforeState: entry.beforeState,
      afterState: entry.afterState,
      reason: entry.reason,
      checksum: `sha256:${Math.random().toString(16).slice(2, 14)}...${nextSeq}`,
      createdAt: new Date().toISOString(),
    };
    this.auditLogs = [newLog, ...this.auditLogs];
  }
}

export const demoStore = new DemoStateStore();

function shouldFallbackToDemo(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const axiosErr = error as AxiosError;
  if (!axiosErr.response) return true; // Network error / timeout / connection refused
  const status = axiosErr.response.status;
  // Stub backend or unimplemented admin route
  return status === 404 || status === 501 || status >= 502;
}

async function withDemoFallback<T>(
  apiCall: () => Promise<T>,
  fallback: () => T
): Promise<T> {
  try {
    const result = await apiCall();
    demoStore.setDemoMode(false);
    return result;
  } catch (error) {
    if (shouldFallbackToDemo(error)) {
      demoStore.setDemoMode(true);
      return fallback();
    }
    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStubPayload(payload: unknown): boolean {
  return isRecord(payload) && payload.message === 'TODO: Implement';
}

export const adminApi = {
  async checkHealth(): Promise<{ online: boolean; mode: 'live' | 'demo' }> {
    try {
      await httpClient.get('/health');
      demoStore.setDemoMode(false);
      return { online: true, mode: 'live' };
    } catch {
      demoStore.setDemoMode(true);
      return { online: false, mode: 'demo' };
    }
  },

  async signIn(params: {
    email: string;
    password: string;
    role: AdminRole;
  }): Promise<AdminSession> {
    try {
      const response = await httpClient.post('/admin/auth/login', {
        email: params.email,
        password: params.password,
      });
      if (isRecord(response.data) && typeof response.data.access_token === 'string') {
        demoStore.setDemoMode(false);
        const session: AdminSession = {
          token: response.data.access_token,
          adminId: String(response.data.admin_id ?? 'admin_live'),
          displayName: String(response.data.display_name ?? params.email.split('@')[0]),
          email: params.email,
          role: (response.data.role as AdminRole) ?? params.role,
          signedInAt: new Date().toISOString(),
        };
        setStoredAdminSession(session);
        return session;
      }
    } catch (error) {
      if (!shouldFallbackToDemo(error)) {
        throw error;
      }
    }

    // Offline / local dev RBAC session fallback
    demoStore.setDemoMode(true);
    const handle = params.email.split('@')[0]?.replace(/[^a-zA-Z0-9_]/g, '_') || 'moderator';
    const demoSession: AdminSession = {
      token: `demo_admin_jwt_${Date.now()}`,
      adminId: `admin_${handle}`,
      displayName: handle.replace(/_/g, ' '),
      email: params.email,
      role: params.role,
      signedInAt: new Date().toISOString(),
    };
    setStoredAdminSession(demoSession);
    return demoSession;
  },

  async getOverview(): Promise<AnalyticsOverview> {
    return withDemoFallback(
      async () => {
        const res = await httpClient.get('/admin/overview');
        if (isStubPayload(res.data) || !isRecord(res.data) || typeof res.data.dau !== 'number') {
          demoStore.setDemoMode(true);
          return buildLiveDemoOverview();
        }
        return res.data as unknown as AnalyticsOverview;
      },
      () => buildLiveDemoOverview()
    );
  },

  async listReports(): Promise<AdminReport[]> {
    return withDemoFallback(
      async () => {
        const res = await httpClient.get('/admin/reports');
        if (isStubPayload(res.data) || !Array.isArray(res.data?.data)) {
          demoStore.setDemoMode(true);
          return [...demoStore.reports];
        }
        return res.data.data as AdminReport[];
      },
      () => [...demoStore.reports]
    );
  },

  async resolveReport(
    reportId: string,
    payload: ModerationDecisionPayload
  ): Promise<AdminReport> {
    return withDemoFallback(
      async () => {
        const res = await httpClient.post(`/admin/reports/${reportId}/action`, payload);
        if (isStubPayload(res.data)) {
          demoStore.setDemoMode(true);
          return applyDemoReportDecision(reportId, payload);
        }
        return res.data as AdminReport;
      },
      () => applyDemoReportDecision(reportId, payload)
    );
  },

  async listPosts(): Promise<AdminPost[]> {
    return withDemoFallback(
      async () => {
        const res = await httpClient.get('/admin/posts');
        if (isStubPayload(res.data) || !Array.isArray(res.data?.data)) {
          demoStore.setDemoMode(true);
          return [...demoStore.posts];
        }
        return res.data.data as AdminPost[];
      },
      () => [...demoStore.posts]
    );
  },

  async moderatePost(
    postId: string,
    status: PostStatus,
    reason: string
  ): Promise<AdminPost> {
    return withDemoFallback(
      async () => {
        const res = await httpClient.patch(`/admin/posts/${postId}/status`, {
          status,
          reason,
        });
        if (isStubPayload(res.data)) {
          demoStore.setDemoMode(true);
          return applyDemoPostStatus(postId, status, reason);
        }
        return res.data as AdminPost;
      },
      () => applyDemoPostStatus(postId, status, reason)
    );
  },

  async listComments(): Promise<AdminComment[]> {
    return withDemoFallback(
      async () => {
        const res = await httpClient.get('/admin/comments');
        if (isStubPayload(res.data) || !Array.isArray(res.data?.data)) {
          demoStore.setDemoMode(true);
          return [...demoStore.comments];
        }
        return res.data.data as AdminComment[];
      },
      () => [...demoStore.comments]
    );
  },

  async moderateComment(
    commentId: string,
    status: CommentStatus,
    reason: string
  ): Promise<AdminComment> {
    return withDemoFallback(
      async () => {
        const res = await httpClient.patch(`/admin/comments/${commentId}/status`, {
          status,
          reason,
        });
        if (isStubPayload(res.data)) {
          demoStore.setDemoMode(true);
          return applyDemoCommentStatus(commentId, status, reason);
        }
        return res.data as AdminComment;
      },
      () => applyDemoCommentStatus(commentId, status, reason)
    );
  },

  async listUsers(): Promise<AdminUser[]> {
    return withDemoFallback(
      async () => {
        const res = await httpClient.get('/admin/users');
        if (isStubPayload(res.data) || !Array.isArray(res.data?.data)) {
          demoStore.setDemoMode(true);
          return [...demoStore.users];
        }
        return res.data.data as AdminUser[];
      },
      () => [...demoStore.users]
    );
  },

  async updateUserStatus(
    userId: string,
    status: UserStatus,
    reason: string
  ): Promise<AdminUser> {
    return withDemoFallback(
      async () => {
        const res = await httpClient.patch(`/admin/users/${userId}/status`, {
          status,
          reason,
        });
        if (isStubPayload(res.data)) {
          demoStore.setDemoMode(true);
          return applyDemoUserStatus(userId, status, reason);
        }
        return res.data as AdminUser;
      },
      () => applyDemoUserStatus(userId, status, reason)
    );
  },

  async listCommunities(): Promise<AdminCommunity[]> {
    return withDemoFallback(
      async () => {
        const res = await httpClient.get('/admin/communities');
        if (isStubPayload(res.data) || !Array.isArray(res.data?.data)) {
          demoStore.setDemoMode(true);
          return [...demoStore.communities];
        }
        return res.data.data as AdminCommunity[];
      },
      () => [...demoStore.communities]
    );
  },

  async updateCommunityStatus(
    communityId: string,
    status: CommunityStatusValue,
    reason: string
  ): Promise<AdminCommunity> {
    return withDemoFallback(
      async () => {
        const res = await httpClient.patch(`/admin/communities/${communityId}/status`, {
          status,
          reason,
        });
        if (isStubPayload(res.data)) {
          demoStore.setDemoMode(true);
          return applyDemoCommunityStatus(communityId, status, reason);
        }
        return res.data as AdminCommunity;
      },
      () => applyDemoCommunityStatus(communityId, status, reason)
    );
  },

  async createCommunity(payload: {
    name: string;
    city: string;
    state: string;
    type: CommunityType;
  }): Promise<AdminCommunity> {
    return withDemoFallback(
      async () => {
        const res = await httpClient.post('/admin/communities', payload);
        if (isStubPayload(res.data)) {
          demoStore.setDemoMode(true);
          return applyDemoCreateCommunity(payload);
        }
        return res.data as AdminCommunity;
      },
      () => applyDemoCreateCommunity(payload)
    );
  },

  async listAppeals(): Promise<ModerationAppeal[]> {
    return withDemoFallback(
      async () => {
        const res = await httpClient.get('/admin/appeals');
        if (isStubPayload(res.data) || !Array.isArray(res.data?.data)) {
          demoStore.setDemoMode(true);
          return [...demoStore.appeals];
        }
        return res.data.data as ModerationAppeal[];
      },
      () => [...demoStore.appeals]
    );
  },

  async resolveAppeal(
    appealId: string,
    status: Exclude<AppealStatus, 'PENDING'>,
    reviewerNote: string
  ): Promise<ModerationAppeal> {
    return withDemoFallback(
      async () => {
        const res = await httpClient.post(`/admin/appeals/${appealId}/resolve`, {
          status,
          reviewer_note: reviewerNote,
        });
        if (isStubPayload(res.data)) {
          demoStore.setDemoMode(true);
          return applyDemoAppealDecision(appealId, status, reviewerNote);
        }
        return res.data as ModerationAppeal;
      },
      () => applyDemoAppealDecision(appealId, status, reviewerNote)
    );
  },

  async listAuditLogs(): Promise<AuditLogEntry[]> {
    return withDemoFallback(
      async () => {
        const res = await httpClient.get('/admin/audit-logs');
        if (isStubPayload(res.data) || !Array.isArray(res.data?.data)) {
          demoStore.setDemoMode(true);
          return [...demoStore.auditLogs];
        }
        return res.data.data as AuditLogEntry[];
      },
      () => [...demoStore.auditLogs]
    );
  },
};

function buildLiveDemoOverview(): AnalyticsOverview {
  const openReports = demoStore.reports.filter(
    (r) => r.status === ReportStatus.RECEIVED || r.status === ReportStatus.UNDER_REVIEW
  );
  const criticalReports = openReports.filter((r) => r.priority === 'CRITICAL');
  const pendingAppeals = demoStore.appeals.filter((a) => a.status === 'PENDING');
  return {
    ...DEMO_ANALYTICS_OVERVIEW,
    openReportsCount: openReports.length,
    criticalReportsCount: criticalReports.length,
    pendingAppealsCount: pendingAppeals.length,
  };
}

function applyDemoReportDecision(
  reportId: string,
  payload: ModerationDecisionPayload
): AdminReport {
  const existing = demoStore.reports.find((r) => r.id === reportId);
  if (!existing) throw new Error('Report not found');

  const nextStatus =
    payload.actionType === ModerationActionType.APPROVE
      ? ReportStatus.DISMISSED
      : payload.actionType === ModerationActionType.ESCALATE
      ? ReportStatus.UNDER_REVIEW
      : ReportStatus.RESOLVED;

  const updated: AdminReport = {
    ...existing,
    status: nextStatus,
    resolvedAt:
      nextStatus === ReportStatus.UNDER_REVIEW ? null : new Date().toISOString(),
    assignedTo: getStoredAdminSession()?.adminId ?? 'admin_console',
  };

  demoStore.reports = demoStore.reports.map((r) =>
    r.id === reportId ? updated : r
  );

  // Reflect target state updates cleanly
  if (payload.actionType === ModerationActionType.REMOVE) {
    if (existing.targetType === 'POST') {
      demoStore.posts = demoStore.posts.map((p) =>
        p.id === existing.targetId ? { ...p, status: PostStatus.REMOVED } : p
      );
    } else if (existing.targetType === 'COMMENT') {
      demoStore.comments = demoStore.comments.map((c) =>
        c.id === existing.targetId ? { ...c, status: CommentStatus.REMOVED } : c
      );
    }
  } else if (
    payload.actionType === ModerationActionType.TEMPORARY_SUSPENSION ||
    payload.actionType === ModerationActionType.PERMANENT_SUSPENSION
  ) {
    demoStore.users = demoStore.users.map((u) =>
      u.id === existing.targetAuthorAnonId
        ? {
            ...u,
            status: UserStatus.SUSPENDED,
            strikesCount: u.strikesCount + 1,
          }
        : u
    );
  }

  demoStore.appendAuditLog({
    action: `MODERATION_${payload.actionType}`,
    resourceType: existing.targetType,
    resourceId: existing.targetId,
    beforeState: { reportStatus: existing.status },
    afterState: {
      reportStatus: updated.status,
      actionType: payload.actionType,
      notes: payload.notes ?? null,
    },
    reason: payload.reason,
  });

  return updated;
}

function applyDemoPostStatus(
  postId: string,
  status: PostStatus,
  reason: string
): AdminPost {
  const existing = demoStore.posts.find((p) => p.id === postId);
  if (!existing) throw new Error('Post not found');
  const updated: AdminPost = { ...existing, status };
  demoStore.posts = demoStore.posts.map((p) => (p.id === postId ? updated : p));
  demoStore.appendAuditLog({
    action: `POST_${status}`,
    resourceType: 'POST',
    resourceId: postId,
    beforeState: { status: existing.status },
    afterState: { status },
    reason,
  });
  return updated;
}

function applyDemoCommentStatus(
  commentId: string,
  status: CommentStatus,
  reason: string
): AdminComment {
  const existing = demoStore.comments.find((c) => c.id === commentId);
  if (!existing) throw new Error('Comment not found');
  const updated: AdminComment = { ...existing, status };
  demoStore.comments = demoStore.comments.map((c) =>
    c.id === commentId ? updated : c
  );
  demoStore.appendAuditLog({
    action: `COMMENT_${status}`,
    resourceType: 'COMMENT',
    resourceId: commentId,
    beforeState: { status: existing.status },
    afterState: { status },
    reason,
  });
  return updated;
}

function applyDemoUserStatus(
  userId: string,
  status: UserStatus,
  reason: string
): AdminUser {
  const existing = demoStore.users.find((u) => u.id === userId);
  if (!existing) throw new Error('User not found');
  const updated: AdminUser = {
    ...existing,
    status,
    strikesCount:
      status === UserStatus.SUSPENDED
        ? existing.strikesCount + 1
        : existing.strikesCount,
  };
  demoStore.users = demoStore.users.map((u) => (u.id === userId ? updated : u));
  demoStore.appendAuditLog({
    action: `USER_${status}`,
    resourceType: 'USER',
    resourceId: userId,
    beforeState: { status: existing.status },
    afterState: { status },
    reason,
  });
  return updated;
}

function applyDemoCommunityStatus(
  communityId: string,
  status: CommunityStatusValue,
  reason: string
): AdminCommunity {
  const existing = demoStore.communities.find((c) => c.id === communityId);
  if (!existing) throw new Error('Community not found');
  const updated: AdminCommunity = { ...existing, status };
  demoStore.communities = demoStore.communities.map((c) =>
    c.id === communityId ? updated : c
  );
  demoStore.appendAuditLog({
    action: 'COMMUNITY_STATUS_UPDATED',
    resourceType: 'COMMUNITY',
    resourceId: communityId,
    beforeState: { status: existing.status },
    afterState: { status },
    reason,
  });
  return updated;
}

function applyDemoCreateCommunity(payload: {
  name: string;
  city: string;
  state: string;
  type: CommunityType;
}): AdminCommunity {
  const slug = `${payload.name}-${payload.city}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const created: AdminCommunity = {
    id: `comm_${Date.now().toString(36)}`,
    name: payload.name,
    slug,
    type: payload.type,
    city: payload.city,
    state: payload.state,
    status: 'ACTIVE',
    memberCount: 1,
    postCount24h: 0,
    activeReportsCount: 0,
    createdAt: new Date().toISOString(),
  };
  demoStore.communities = [created, ...demoStore.communities];
  demoStore.appendAuditLog({
    action: 'COMMUNITY_CREATED',
    resourceType: 'COMMUNITY',
    resourceId: created.id,
    beforeState: null,
    afterState: { name: created.name, city: created.city, status: created.status },
    reason: `Activated ${created.type} community for ${created.city}`,
  });
  return created;
}

function applyDemoAppealDecision(
  appealId: string,
  status: Exclude<AppealStatus, 'PENDING'>,
  reviewerNote: string
): ModerationAppeal {
  const existing = demoStore.appeals.find((a) => a.id === appealId);
  if (!existing) throw new Error('Appeal not found');
  const updated: ModerationAppeal = {
    ...existing,
    status,
    reviewerNote,
    resolvedAt: new Date().toISOString(),
  };
  demoStore.appeals = demoStore.appeals.map((a) =>
    a.id === appealId ? updated : a
  );
  if (status === 'APPROVED') {
    demoStore.users = demoStore.users.map((u) =>
      u.id === existing.userAnonId ? { ...u, status: UserStatus.ACTIVE } : u
    );
  }
  demoStore.appendAuditLog({
    action: `APPEAL_${status}`,
    resourceType: 'APPEAL',
    resourceId: appealId,
    beforeState: { status: existing.status },
    afterState: { status, reviewerNote },
    reason: reviewerNote,
  });
  return updated;
}
