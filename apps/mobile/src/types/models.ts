import {
  CommunityType,
  NotificationType,
  PostCategory,
  ReactionType,
  ReportReason,
  Visibility,
} from '@diriddle/shared-types';

export {
  CommunityType,
  NotificationType,
  PostCategory,
  ReactionType,
  ReportReason,
  Visibility,
};

export interface PollOptionData {
  id: string;
  option_text?: string;
  text?: string;
  votes?: number;
  voteCount?: number;
}

export interface PollData {
  id: string;
  question: string;
  options: PollOptionData[];
  closes_at?: string;
  closesAt?: string;
  total_votes?: number;
  user_voted_option_id?: string | null;
}

export interface PostAttachment {
  id: string;
  url: string;
  mime_type?: string;
  size_bytes?: number;
}

export interface PostItem {
  id: string;
  anonymous_name: string;
  author_user_id?: string;
  category: PostCategory;
  content: string;
  status: string;
  community_id: string;
  community_name?: string;
  city?: string;
  comment_count: number;
  reaction_count: number;
  reaction_counts?: Partial<Record<ReactionType, number>>;
  my_reaction?: ReactionType | null;
  is_saved?: boolean;
  is_own?: boolean;
  comments_enabled?: boolean;
  visibility?: Visibility;
  poll?: PollData | null;
  attachments?: PostAttachment[];
  created_at: string;
}

export interface CommentReply {
  id: string;
  anonymous_name: string;
  content: string;
  created_at: string;
}

export interface CommentItem {
  id: string;
  anonymous_name: string;
  content: string;
  created_at: string;
  replies: CommentReply[];
}

export interface CommunityItem {
  id: string;
  name: string;
  slug: string;
  type: CommunityType;
  city?: string | null;
  state?: string | null;
  member_count?: number;
  is_joined?: boolean;
  description?: string;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  reference_id?: string | null;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface AnonymousIdentityItem {
  id: string;
  community_id: string;
  community_name: string;
  display_code: string;
  created_at: string;
}

export interface BlockedAccountItem {
  blocked_id: string;
  display_label: string;
  created_at: string;
}

export interface MyReportItem {
  id: string;
  target_type: string;
  reason: ReportReason;
  status: string;
  created_at: string;
}

export const POST_CATEGORIES: { key: PostCategory; label: string; emoji: string }[] = [
  { key: PostCategory.CONFESSION, label: 'Confession', emoji: '🤫' },
  { key: PostCategory.STORY, label: 'Story', emoji: '📖' },
  { key: PostCategory.QUESTION, label: 'Question', emoji: '❓' },
  { key: PostCategory.GOSSIP, label: 'Gossip', emoji: '💬' },
  { key: PostCategory.RANT, label: 'Rant', emoji: '😤' },
  { key: PostCategory.CAMPUS, label: 'Campus', emoji: '🎓' },
  { key: PostCategory.NEIGHBORHOOD, label: 'Neighborhood', emoji: '🏘️' },
  { key: PostCategory.LOCAL_ALERT, label: 'Local Alert', emoji: '🚨' },
  { key: PostCategory.POLL, label: 'Poll', emoji: '📊' },
];

export const REACTION_OPTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: ReactionType.LIKE, emoji: '👍', label: 'Like' },
  { type: ReactionType.HEART, emoji: '❤️', label: 'Love' },
  { type: ReactionType.LAUGH, emoji: '😂', label: 'Haha' },
  { type: ReactionType.WOW, emoji: '😮', label: 'Wow' },
  { type: ReactionType.SAD, emoji: '😢', label: 'Sad' },
  { type: ReactionType.ANGRY, emoji: '😡', label: 'Angry' },
];

export const REPORT_REASONS: { reason: ReportReason; label: string; description: string }[] = [
  { reason: ReportReason.HARASSMENT, label: 'Harassment', description: 'Bullying, threats, or targeted abuse' },
  { reason: ReportReason.DOXXING, label: 'Doxxing / PII', description: 'Exposing real names, phones, or addresses' },
  { reason: ReportReason.HATE_SPEECH, label: 'Hate Speech', description: 'Attacks based on protected characteristics' },
  { reason: ReportReason.SPAM, label: 'Spam', description: 'Promotions, scams, or repetitive junk' },
  { reason: ReportReason.MISINFORMATION, label: 'Misinformation', description: 'Harmful false local alerts or rumors' },
  { reason: ReportReason.NSFW, label: 'NSFW / Explicit', description: 'Inappropriate sexual or graphic content' },
  { reason: ReportReason.IMPERSONATION, label: 'Impersonation', description: 'Pretending to be someone else' },
  { reason: ReportReason.OTHER, label: 'Other', description: 'Another community guideline violation' },
];

