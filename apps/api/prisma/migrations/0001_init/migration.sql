-- diriddle initial PostgreSQL + PostGIS migration
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');
CREATE TYPE "CommunityType" AS ENUM ('CITY', 'NEIGHBORHOOD', 'CAMPUS', 'SPECIAL');
CREATE TYPE "CommunityStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING');
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'LEFT', 'BANNED');
CREATE TYPE "PostCategory" AS ENUM ('CONFESSION', 'STORY', 'QUESTION', 'GOSSIP', 'RANT', 'CAMPUS', 'NEIGHBORHOOD', 'LOCAL_ALERT', 'POLL');
CREATE TYPE "PostStatus" AS ENUM ('PUBLISHED', 'DRAFT', 'UNDER_REVIEW', 'REMOVED', 'EXPIRED');
CREATE TYPE "Visibility" AS ENUM ('COMMUNITY', 'PUBLIC');
CREATE TYPE "CommentStatus" AS ENUM ('ACTIVE', 'REMOVED', 'FLAGGED');
CREATE TYPE "ReactionType" AS ENUM ('LIKE', 'HEART', 'LAUGH', 'WOW', 'SAD', 'ANGRY');
CREATE TYPE "ReportReason" AS ENUM ('HARASSMENT', 'SPAM', 'DOXXING', 'HATE_SPEECH', 'MISINFORMATION', 'IMPERSONATION', 'NSFW', 'OTHER');
CREATE TYPE "ReportStatus" AS ENUM ('RECEIVED', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');
CREATE TYPE "ModerationActionType" AS ENUM ('APPROVE', 'REMOVE', 'RESTRICT', 'WARN', 'TEMPORARY_SUSPENSION', 'PERMANENT_SUSPENSION', 'ESCALATE');
CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE "NotificationType" AS ENUM ('COMMENT_REPLY', 'REACTION', 'COMMUNITY_POST', 'SYSTEM');
CREATE TYPE "AdminRoleType" AS ENUM ('SUPER_ADMIN', 'TRUST_SAFETY_LEAD', 'TRUST_SAFETY', 'MODERATION_LEAD', 'MODERATOR', 'COMMUNITY_MANAGER', 'ANALYST');

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "auth_id" TEXT NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "age_verified" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_auth_id_key" ON "users"("auth_id");

CREATE TABLE "communities" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "type" "CommunityType" NOT NULL,
  "city" TEXT,
  "state" TEXT,
  "geo_cell" TEXT,
  "status" "CommunityStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "communities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "communities_slug_key" ON "communities"("slug");
CREATE INDEX "communities_city_status_idx" ON "communities"("city", "status");

CREATE TABLE "anonymous_identities" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "community_id" TEXT,
  "display_code" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "anonymous_identities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "anonymous_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "anonymous_identities_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "anonymous_identities_user_id_community_id_key" ON "anonymous_identities"("user_id", "community_id") WHERE "community_id" IS NOT NULL;
CREATE UNIQUE INDEX "anonymous_identities_user_id_global_key" ON "anonymous_identities"("user_id") WHERE "community_id" IS NULL;

CREATE TABLE "community_members" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "community_id" TEXT NOT NULL,
  "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "community_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "community_members_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "community_members_user_id_community_id_key" ON "community_members"("user_id", "community_id");

CREATE TABLE "posts" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "anonymous_identity_id" TEXT NOT NULL,
  "community_id" TEXT NOT NULL,
  "category" "PostCategory" NOT NULL,
  "content" TEXT NOT NULL,
  "status" "PostStatus" NOT NULL DEFAULT 'PUBLISHED',
  "visibility" "Visibility" NOT NULL DEFAULT 'COMMUNITY',
  "comments_enabled" BOOLEAN NOT NULL DEFAULT true,
  "geo_cell" TEXT,
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "posts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "posts_anonymous_identity_id_fkey" FOREIGN KEY ("anonymous_identity_id") REFERENCES "anonymous_identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "posts_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "posts_community_status_created_idx" ON "posts"("community_id", "status", "created_at" DESC) WHERE "deleted_at" IS NULL;
CREATE INDEX "posts_category_status_created_idx" ON "posts"("category", "status", "created_at" DESC) WHERE "deleted_at" IS NULL;
CREATE INDEX "posts_published_feed_idx" ON "posts"("created_at" DESC) WHERE "status" = 'PUBLISHED' AND "deleted_at" IS NULL;

CREATE TABLE "post_media" (
  "id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "media_type" TEXT NOT NULL,
  "storage_key" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "post_media_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "post_media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "comments" (
  "id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "anonymous_identity_id" TEXT NOT NULL,
  "parent_comment_id" TEXT,
  "content" TEXT NOT NULL,
  "status" "CommentStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "comments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "comments_anonymous_identity_id_fkey" FOREIGN KEY ("anonymous_identity_id") REFERENCES "anonymous_identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "comments_post_status_created_idx" ON "comments"("post_id", "status", "created_at" ASC);

CREATE TABLE "reactions" (
  "id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "reaction_type" "ReactionType" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "reactions_post_id_user_id_key" ON "reactions"("post_id", "user_id");

CREATE TABLE "saved_posts" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saved_posts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "saved_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "saved_posts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "saved_posts_user_id_post_id_key" ON "saved_posts"("user_id", "post_id");

CREATE TABLE "reports" (
  "id" TEXT NOT NULL,
  "reporter_id" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "reason" "ReportReason" NOT NULL,
  "description" TEXT,
  "status" "ReportStatus" NOT NULL DEFAULT 'RECEIVED',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  CONSTRAINT "reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "reports_status_priority_created_idx" ON "reports"("status", "priority", "created_at" ASC);

CREATE TABLE "blocks" (
  "id" TEXT NOT NULL,
  "blocker_id" TEXT NOT NULL,
  "blocked_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "blocks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "blocks_no_self_block" CHECK ("blocker_id" <> "blocked_id"),
  CONSTRAINT "blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "blocks_blocker_id_blocked_id_key" ON "blocks"("blocker_id", "blocked_id");

CREATE TABLE "notifications" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "reference_id" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "notifications_user_read_created_idx" ON "notifications"("user_id", "read_at", "created_at" DESC);

CREATE TABLE "device_tokens" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "device_tokens_user_id_token_key" ON "device_tokens"("user_id", "token");

CREATE TABLE "notification_preferences" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "notification_type" TEXT NOT NULL,
  "push_enabled" BOOLEAN NOT NULL DEFAULT true,
  "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "notification_preferences_user_id_notification_type_key" ON "notification_preferences"("user_id", "notification_type");

CREATE TABLE "moderation_actions" (
  "id" TEXT NOT NULL,
  "moderator_id" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "action_type" "ModerationActionType" NOT NULL,
  "reason" TEXT NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3),
  CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "moderation_actions_target_idx" ON "moderation_actions"("target_type", "target_id");

CREATE TABLE "moderation_appeals" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "moderation_action_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
  "reviewer_id" TEXT,
  "resolution_notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  CONSTRAINT "moderation_appeals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "moderation_appeals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "moderation_appeals_moderation_action_id_fkey" FOREIGN KEY ("moderation_action_id") REFERENCES "moderation_actions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "moderation_appeals_status_created_idx" ON "moderation_appeals"("status", "created_at" ASC);

CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "resource_type" TEXT NOT NULL,
  "resource_id" TEXT NOT NULL,
  "before_state" JSONB,
  "after_state" JSONB,
  "ip_address" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "audit_logs_resource_created_idx" ON "audit_logs"("resource_type", "resource_id", "created_at" DESC);

CREATE TABLE "user_consents" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "consent_type" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "granted" BOOLEAN NOT NULL,
  "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip_address" TEXT,
  CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "location_preferences" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "selected_city" TEXT,
  "selected_state" TEXT,
  "geo_cell" TEXT,
  "location_permission_granted" BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "location_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "location_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "location_preferences_user_id_key" ON "location_preferences"("user_id");

CREATE TABLE "idempotency_keys" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "resource_type" TEXT NOT NULL,
  "resource_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "idempotency_keys_user_id_key_key" ON "idempotency_keys"("user_id", "key");

CREATE TABLE "polls" (
  "id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "closes_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "polls_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "polls_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "polls_post_id_key" ON "polls"("post_id");

CREATE TABLE "poll_options" (
  "id" TEXT NOT NULL,
  "poll_id" TEXT NOT NULL,
  "option_text" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "poll_options_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "poll_votes" (
  "id" TEXT NOT NULL,
  "poll_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "poll_option_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "poll_votes_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "poll_votes_poll_option_id_fkey" FOREIGN KEY ("poll_option_id") REFERENCES "poll_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "poll_votes_poll_id_user_id_key" ON "poll_votes"("poll_id", "user_id");

CREATE TABLE "admin_roles" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" "AdminRoleType" NOT NULL,
  "scope" TEXT,
  "scope_id" TEXT,
  "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3),
  CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "admin_roles_user_id_key" ON "admin_roles"("user_id");
