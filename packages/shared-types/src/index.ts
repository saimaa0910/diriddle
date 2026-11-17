export enum PostCategory {
  CONFESSION = 'CONFESSION',
  STORY = 'STORY',
  QUESTION = 'QUESTION',
  GOSSIP = 'GOSSIP',
  RANT = 'RANT',
  CAMPUS = 'CAMPUS',
  NEIGHBORHOOD = 'NEIGHBORHOOD',
  LOCAL_ALERT = 'LOCAL_ALERT',
  POLL = 'POLL',
  GENERAL = 'GENERAL',
}

export enum PostStatus {
  PUBLISHED = 'PUBLISHED',
  DRAFT = 'DRAFT',
  UNDER_REVIEW = 'UNDER_REVIEW',
  REMOVED = 'REMOVED',
  EXPIRED = 'EXPIRED',
}

export enum CommentStatus {
  ACTIVE = 'ACTIVE',
  REMOVED = 'REMOVED',
  FLAGGED = 'FLAGGED',
}

export enum UserStatus {
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  ACTIVE = 'ACTIVE',
  DEACTIVATED = 'DEACTIVATED',
  SUSPENDED = 'SUSPENDED',
  DELETION_PENDING = 'DELETION_PENDING',
  DELETED = 'DELETED',
}

export enum CommunityType {
  CITY = 'CITY',
  NEIGHBORHOOD = 'NEIGHBORHOOD',
  CAMPUS = 'CAMPUS',
  SPECIAL = 'SPECIAL',
}

export enum CommunityStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
}

export enum MembershipStatus {
  ACTIVE = 'ACTIVE',
  LEFT = 'LEFT',
  BANNED = 'BANNED',
}

export enum ReactionType {
  LIKE = 'LIKE',
  HEART = 'HEART',
  LAUGH = 'LAUGH',
  WOW = 'WOW',
  SAD = 'SAD',
  ANGRY = 'ANGRY',
}

export enum ReportReason {
  HARASSMENT = 'HARASSMENT',
  SPAM = 'SPAM',
  DOXXING = 'DOXXING',
  HATE_SPEECH = 'HATE_SPEECH',
  MISINFORMATION = 'MISINFORMATION',
  IMPERSONATION = 'IMPERSONATION',
  NSFW = 'NSFW',
  OTHER = 'OTHER',
}

export enum ReportStatus {
  RECEIVED = 'RECEIVED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED',
}

export enum ModerationActionType {
  APPROVE = 'APPROVE',
  REMOVE = 'REMOVE',
  RESTRICT = 'RESTRICT',
  WARN = 'WARN',
  TEMPORARY_SUSPENSION = 'TEMPORARY_SUSPENSION',
  PERMANENT_SUSPENSION = 'PERMANENT_SUSPENSION',
  ESCALATE = 'ESCALATE',
}

export enum NotificationType {
  COMMENT_REPLY = 'COMMENT_REPLY',
  REACTION = 'REACTION',
  COMMUNITY_POST = 'COMMUNITY_POST',
  SYSTEM = 'SYSTEM',
  MENTION = 'MENTION',
}

export enum Visibility {
  COMMUNITY = 'COMMUNITY',
  PUBLIC = 'PUBLIC',
  SELECTED_COMMUNITIES = 'SELECTED_COMMUNITIES',
  PRIVATE = 'PRIVATE',
}

export enum AuthProvider {
  PHONE = 'PHONE',
  EMAIL = 'EMAIL',
  GOOGLE = 'GOOGLE',
  APPLE = 'APPLE',
}

export type AdminRoleType = 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR' | 'ANALYST' | 'TRUST_SAFETY_LEAD';
export const AdminRoleType = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  MODERATOR: 'MODERATOR',
  ANALYST: 'ANALYST',
  TRUST_SAFETY_LEAD: 'TRUST_SAFETY_LEAD',
} as const;

export interface PaginatedResponse<T> {
  data: T[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface ErrorEnvelope {
  statusCode: number;
  error: string;
  code?: string;
  message: string;
  requestId: string;
  timestamp?: string;
}

export type ReactionCounts = Partial<Record<ReactionType, number>>;

export interface AnonymousIdentityDto {
  id: string;
  community_id: string | null;
  community_name?: string;
  display_code: string;
  is_global?: boolean;
  created_at: string;
}

export interface PostDto {
  id: string;
  anonymous_name: string;
  anonymous_identity_id?: string;
  community_id: string;
  community_name?: string;
  category: PostCategory;
  content: string;
  status: PostStatus;
  visibility: Visibility;
  comments_enabled: boolean;
  comment_count: number;
  reaction_count: number;
  reaction_counts?: ReactionCounts;
  user_reaction?: ReactionType | null;
  is_saved?: boolean;
  is_pinned?: boolean;
  is_draft?: boolean;
  expires_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface CommentDto {
  id: string;
  post_id: string;
  parent_comment_id?: string | null;
  anonymous_name: string;
  content: string;
  status: CommentStatus;
  is_own?: boolean;
  created_at: string;
  replies?: CommentDto[];
}

export interface CommunityDto {
  id: string;
  name: string;
  slug: string;
  type: CommunityType;
  city?: string | null;
  state?: string | null;
  status: CommunityStatus;
  member_count?: number;
  post_count?: number;
  is_member?: boolean;
  is_private?: boolean;
  created_at: string;
}

export interface UserProfileDto {
  id: string;
  status: UserStatus;
  age_verified: boolean;
  selected_city?: string | null;
  selected_state?: string | null;
  location_permission_granted?: boolean;
  identities_count?: number;
  profile?: {
    display_name?: string | null;
    avatar_seed?: string | null;
    bio?: string | null;
    interests?: string[];
    preferred_language?: string;
  };
  created_at: string;
}

export interface CityDto {
  name: string;
  slug: string;
  state?: string | null;
  geo_cell?: string;
  is_active?: boolean;
}

export interface SessionDto {
  id: string;
  device_id?: string | null;
  device_name?: string | null;
  platform?: string | null;
  last_active_at: string;
  created_at: string;
}

export interface NotificationDto {
  id: string;
  type: NotificationType;
  reference_id?: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface CreatePostPayload {
  community_id: string;
  category: PostCategory;
  content: string;
  visibility?: Visibility;
  comments_enabled?: boolean;
  is_draft?: boolean;
  attachment_ids?: string[];
  audience_community_ids?: string[];
  idempotency_key?: string;
}

export interface RealtimeEvents {
  'community:join': { communityId: string };
  'community:joined': { communityId: string };
  'community:leave': { communityId: string };
  'community:left': { communityId: string };
  'post:created': PostDto;
  'comment:created': CommentDto;
  'reaction:updated': {
    postId: string;
    reactionCounts: ReactionCounts;
    totalReactions: number;
  };
  'notification:new': NotificationDto;
}
