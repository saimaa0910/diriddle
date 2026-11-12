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
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
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
}

export enum Visibility {
  COMMUNITY = 'COMMUNITY',
  PUBLIC = 'PUBLIC',
}

export enum AdminRoleType {
  SUPER_ADMIN = 'SUPER_ADMIN',
  MODERATION_LEAD = 'MODERATION_LEAD',
  MODERATOR = 'MODERATOR',
  TRUST_SAFETY = 'TRUST_SAFETY',
  COMMUNITY_MANAGER = 'COMMUNITY_MANAGER',
  ANALYST = 'ANALYST',
}

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
