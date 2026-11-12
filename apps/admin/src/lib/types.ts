import {
  CommentStatus,
  CommunityType,
  ErrorEnvelope,
  ModerationActionType,
  PaginatedResponse,
  PostCategory,
  PostStatus,
  ReportReason,
  ReportStatus,
  UserStatus,
} from '@diriddle/shared-types';

export {
  CommentStatus,
  CommunityType,
  ModerationActionType,
  PostCategory,
  PostStatus,
  ReportReason,
  ReportStatus,
  UserStatus,
};
export type { ErrorEnvelope, PaginatedResponse };

export type AdminRole =
  | 'MODERATOR'
  | 'SENIOR_MODERATOR'
  | 'TRUST_SAFETY_LEAD'
  | 'SUPER_ADMIN';

export interface AdminSession {
  token: string;
  adminId: string;
  displayName: string;
  email: string;
  role: AdminRole;
  signedInAt: string;
}

export type ReportPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
export type ReportTargetType = 'POST' | 'COMMENT' | 'USER';
export type CommunityStatusValue = 'ACTIVE' | 'INACTIVE' | 'PENDING';
export type AppealStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AdminReport {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  targetPreview: string;
  targetAuthorAnonId: string;
  targetAuthorDisplayCode: string;
  communityName: string;
  city: string;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  priority: ReportPriority;
  reporterAnonId: string;
  reportCount: number;
  createdAt: string;
  resolvedAt: string | null;
  assignedTo: string | null;
}

export interface AdminPost {
  id: string;
  anonymousDisplayCode: string;
  authorAnonId: string;
  communityId: string;
  communityName: string;
  city: string;
  category: PostCategory;
  content: string;
  status: PostStatus;
  reportCount: number;
  reactionCount: number;
  commentCount: number;
  autoFlagReason: string | null;
  createdAt: string;
}

export interface AdminComment {
  id: string;
  postId: string;
  postSnippet: string;
  anonymousDisplayCode: string;
  authorAnonId: string;
  communityName: string;
  content: string;
  status: CommentStatus;
  reportCount: number;
  createdAt: string;
}

/**
 * Strictly anonymized user record for ordinary moderators.
 * Real phone, email, IP, and device identifiers are excluded by design.
 */
export interface AdminUser {
  id: string;
  anonymizedHandle: string;
  status: UserStatus;
  ageVerified: boolean;
  activeCommunitiesCount: number;
  postsCount: number;
  reportsAgainstCount: number;
  strikesCount: number;
  primaryCity: string;
  lastActiveAt: string;
  createdAt: string;
}

export interface AdminCommunity {
  id: string;
  name: string;
  slug: string;
  type: CommunityType;
  city: string;
  state: string;
  status: CommunityStatusValue;
  memberCount: number;
  postCount24h: number;
  activeReportsCount: number;
  createdAt: string;
}

export interface ModerationAppeal {
  id: string;
  userAnonId: string;
  targetType: ReportTargetType;
  targetId: string;
  targetPreview: string;
  originalAction: ModerationActionType;
  originalReason: string;
  appealStatement: string;
  status: AppealStatus;
  reviewerNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface AuditLogEntry {
  id: string;
  seq: number;
  actorAnonId: string;
  actorRole: AdminRole;
  action: string;
  resourceType: string;
  resourceId: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  reason: string;
  checksum: string;
  createdAt: string;
}

export interface DailyMetricPoint {
  date: string;
  dau: number;
  posts: number;
  reportsResolved: number;
  avgResponseMin: number;
}

export interface CityMetricPoint {
  city: string;
  state: string;
  dau: number;
  posts24h: number;
  openReports: number;
  status: CommunityStatusValue;
}

export interface CategoryMetricPoint {
  category: PostCategory;
  count: number;
  sharePercent: number;
}

export interface SystemServiceHealth {
  name: string;
  status: 'OPERATIONAL' | 'DEGRADED' | 'OFFLINE';
  latencyMs: number;
  detail: string;
}

export interface AnalyticsOverview {
  dau: number;
  mau: number;
  dauMauRatio: number;
  postsLast24h: number;
  commentsLast24h: number;
  openReportsCount: number;
  criticalReportsCount: number;
  pendingAppealsCount: number;
  medianResponseMinutes: number;
  p95ResponseMinutes: number;
  dailyMetrics: DailyMetricPoint[];
  cityBreakdown: CityMetricPoint[];
  categoryBreakdown: CategoryMetricPoint[];
  systemHealth: SystemServiceHealth[];
}

export interface ModerationDecisionPayload {
  actionType: ModerationActionType;
  reason: string;
  notes?: string;
}
