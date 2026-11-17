-- ============================================================
-- Migration: 0003_complete_schema
-- Full SQL for new tables and alterations (Postgres)
-- Uses IF NOT EXISTS / ADD VALUE IF NOT EXISTS for idempotency
-- ============================================================

-- ─── Enum additions ─────────────────────────────────────────

DO $$ BEGIN
  ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'PENDING_VERIFICATION';
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'DEACTIVATED';
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'DELETION_PENDING';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE "Visibility" ADD VALUE IF NOT EXISTS 'PRIVATE';
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TYPE "Visibility" ADD VALUE IF NOT EXISTS 'SELECTED_COMMUNITIES';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── New enum types ──────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "AuthProvider" AS ENUM ('EMAIL', 'PHONE', 'GOOGLE', 'APPLE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "DeletionRequestStatus" AS ENUM ('PENDING', 'CANCELLED', 'EXECUTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "AgeVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CommunityRoleType" AS ENUM ('OWNER', 'MODERATOR', 'MEMBER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "AttachmentType" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "AttachmentStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'DELETED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "AttachmentScanStatus" AS ENUM ('PENDING', 'CLEAN', 'FLAGGED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "SearchType" AS ENUM ('POST', 'COMMUNITY', 'HASHTAG', 'CITY');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── Alter existing tables ───────────────────────────────────

-- anonymous_identities: add new columns
ALTER TABLE "anonymous_identities"
  ADD COLUMN IF NOT EXISTS "avatar_code" TEXT,
  ADD COLUMN IF NOT EXISTS "is_global"   BOOLEAN NOT NULL DEFAULT FALSE;

-- communities: add new columns
ALTER TABLE "communities"
  ADD COLUMN IF NOT EXISTS "owner_id"    TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "avatar_url"  TEXT,
  ADD COLUMN IF NOT EXISTS "cover_url"   TEXT,
  ADD COLUMN IF NOT EXISTS "is_private"  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "max_members" INTEGER;

-- Add FK for community owner (after column exists)
DO $$ BEGIN
  ALTER TABLE "communities"
    ADD CONSTRAINT "communities_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- posts: add new columns
ALTER TABLE "posts"
  ADD COLUMN IF NOT EXISTS "is_draft"   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "is_pinned"  BOOLEAN NOT NULL DEFAULT FALSE;

-- Add new indexes on posts
CREATE INDEX IF NOT EXISTS "posts_user_id_deleted_at_idx"
  ON "posts" ("user_id", "deleted_at");
CREATE INDEX IF NOT EXISTS "posts_geo_cell_status_idx"
  ON "posts" ("geo_cell", "status");

-- reactions: add index on postId
CREATE INDEX IF NOT EXISTS "reactions_post_id_idx"
  ON "reactions" ("post_id");

-- reports: add new columns
ALTER TABLE "reports"
  ADD COLUMN IF NOT EXISTS "community_id"   TEXT,
  ADD COLUMN IF NOT EXISTS "evidence_urls"  TEXT[] NOT NULL DEFAULT '{}';

-- ─── New tables ──────────────────────────────────────────────

-- user_profiles
CREATE TABLE IF NOT EXISTS "user_profiles" (
  "id"                TEXT    NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "user_id"           TEXT    NOT NULL UNIQUE,
  "display_name"      TEXT,
  "avatar_url"        TEXT,
  "interests"         TEXT[]  NOT NULL DEFAULT '{}',
  "age_band"          TEXT,
  "gender"            TEXT,
  "preferred_language" TEXT,
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "user_profiles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- auth_identities
CREATE TABLE IF NOT EXISTS "auth_identities" (
  "id"          TEXT         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "user_id"     TEXT         NOT NULL,
  "provider"    "AuthProvider" NOT NULL,
  "identifier"  TEXT         NOT NULL,
  "verified_at" TIMESTAMPTZ,
  "is_primary"  BOOLEAN      NOT NULL DEFAULT FALSE,
  "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "auth_identities_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "auth_identities_provider_identifier_key"
  ON "auth_identities" ("provider", "identifier");

-- sessions
CREATE TABLE IF NOT EXISTS "sessions" (
  "id"             TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "user_id"        TEXT        NOT NULL,
  "jti"            TEXT        NOT NULL UNIQUE,
  "device_id"      TEXT,
  "device_name"    TEXT,
  "platform"       TEXT,
  "ip_address"     TEXT,
  "user_agent"     TEXT,
  "last_active_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expires_at"     TIMESTAMPTZ NOT NULL,
  "revoked_at"     TIMESTAMPTZ,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- login_history
CREATE TABLE IF NOT EXISTS "login_history" (
  "id"               TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "user_id"          TEXT        NOT NULL,
  "ip_address"       TEXT,
  "user_agent"       TEXT,
  "platform"         TEXT,
  "approximate_city" TEXT,
  "success"          BOOLEAN     NOT NULL,
  "fail_reason"      TEXT,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "login_history_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- deletion_requests
CREATE TABLE IF NOT EXISTS "deletion_requests" (
  "id"           TEXT                   NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "user_id"      TEXT                   NOT NULL UNIQUE,
  "requested_at" TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  "scheduled_at" TIMESTAMPTZ,
  "cancelled_at" TIMESTAMPTZ,
  "executed_at"  TIMESTAMPTZ,
  "reason"       TEXT,
  "status"       "DeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
  CONSTRAINT "deletion_requests_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- age_verifications
CREATE TABLE IF NOT EXISTS "age_verifications" (
  "id"                TEXT                   NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "user_id"           TEXT                   NOT NULL UNIQUE,
  "status"            "AgeVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "method"            TEXT,
  "provider_metadata" JSONB,
  "verified_at"       TIMESTAMPTZ,
  "expires_at"        TIMESTAMPTZ,
  "policy_version"    TEXT,
  "created_at"        TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  CONSTRAINT "age_verifications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- countries
CREATE TABLE IF NOT EXISTS "countries" (
  "id"         TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "name"       TEXT        NOT NULL,
  "code"       TEXT        NOT NULL UNIQUE,
  "is_active"  BOOLEAN     NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- states
CREATE TABLE IF NOT EXISTS "states" (
  "id"         TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "country_id" TEXT        NOT NULL,
  "name"       TEXT        NOT NULL,
  "code"       TEXT,
  "is_active"  BOOLEAN     NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "states_country_id_fkey"
    FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE CASCADE
);

-- cities
CREATE TABLE IF NOT EXISTS "cities" (
  "id"           TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "state_id"     TEXT        NOT NULL,
  "name"         TEXT        NOT NULL,
  "slug"         TEXT        NOT NULL UNIQUE,
  "aliases"      TEXT[]      NOT NULL DEFAULT '{}',
  "center_lat"   DOUBLE PRECISION,
  "center_lng"   DOUBLE PRECISION,
  "radius_km"    DOUBLE PRECISION,
  "is_active"    BOOLEAN     NOT NULL DEFAULT FALSE,
  "activated_at" TIMESTAMPTZ,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "cities_state_id_fkey"
    FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "cities_is_active_idx" ON "cities" ("is_active");

-- spatial_cells
CREATE TABLE IF NOT EXISTS "spatial_cells" (
  "id"         TEXT             NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "city_id"    TEXT             NOT NULL,
  "cell_code"  TEXT             NOT NULL UNIQUE,
  "level"      INTEGER          NOT NULL,
  "center_lat" DOUBLE PRECISION,
  "center_lng" DOUBLE PRECISION,
  "radius_km"  DOUBLE PRECISION,
  CONSTRAINT "spatial_cells_city_id_fkey"
    FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE CASCADE
);

-- temporary_user_gps  (no index on lat/lng for privacy)
CREATE TABLE IF NOT EXISTS "temporary_user_gps" (
  "id"          TEXT             NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "user_id"     TEXT             NOT NULL UNIQUE,
  "lat"         DOUBLE PRECISION NOT NULL,
  "lng"         DOUBLE PRECISION NOT NULL,
  "geo_cell"    TEXT,
  "captured_at" TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  "expires_at"  TIMESTAMPTZ      NOT NULL,
  CONSTRAINT "temporary_user_gps_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "temporary_user_gps_expires_at_idx"
  ON "temporary_user_gps" ("expires_at");

-- community_rules
CREATE TABLE IF NOT EXISTS "community_rules" (
  "id"           TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "community_id" TEXT        NOT NULL,
  "title"        TEXT        NOT NULL,
  "description"  TEXT,
  "order_index"  INTEGER     NOT NULL DEFAULT 0,
  "version"      INTEGER     NOT NULL DEFAULT 1,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at"   TIMESTAMPTZ,
  CONSTRAINT "community_rules_community_id_fkey"
    FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE
);

-- community_bans
CREATE TABLE IF NOT EXISTS "community_bans" (
  "id"           TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "community_id" TEXT        NOT NULL,
  "user_id"      TEXT        NOT NULL,
  "reason"       TEXT,
  "banned_by_id" TEXT        NOT NULL,
  "banned_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expires_at"   TIMESTAMPTZ,
  "is_active"    BOOLEAN     NOT NULL DEFAULT TRUE,
  "notes"        TEXT,
  CONSTRAINT "community_bans_community_id_fkey"
    FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE,
  CONSTRAINT "community_bans_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "community_bans_banned_by_id_fkey"
    FOREIGN KEY ("banned_by_id") REFERENCES "users"("id")
);

-- join_requests
CREATE TABLE IF NOT EXISTS "join_requests" (
  "id"             TEXT               NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "community_id"   TEXT               NOT NULL,
  "user_id"        TEXT               NOT NULL,
  "message"        TEXT,
  "status"         "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by_id" TEXT,
  "created_at"     TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  CONSTRAINT "join_requests_community_id_fkey"
    FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE,
  CONSTRAINT "join_requests_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "join_requests_reviewed_by_id_fkey"
    FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "join_requests_community_id_user_id_key"
  ON "join_requests" ("community_id", "user_id");

-- community_roles
CREATE TABLE IF NOT EXISTS "community_roles" (
  "id"            TEXT               NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "community_id"  TEXT               NOT NULL,
  "user_id"       TEXT               NOT NULL,
  "role"          "CommunityRoleType" NOT NULL,
  "permissions"   TEXT[]             NOT NULL DEFAULT '{}',
  "granted_at"    TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  "granted_by_id" TEXT               NOT NULL,
  "revoked_at"    TIMESTAMPTZ,
  CONSTRAINT "community_roles_community_id_fkey"
    FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE,
  CONSTRAINT "community_roles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "community_roles_granted_by_id_fkey"
    FOREIGN KEY ("granted_by_id") REFERENCES "users"("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "community_roles_community_id_user_id_key"
  ON "community_roles" ("community_id", "user_id");

-- identity_history
CREATE TABLE IF NOT EXISTS "identity_history" (
  "id"                    TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "identity_id"           TEXT        NOT NULL,
  "previous_display_code" TEXT,
  "new_display_code"      TEXT,
  "previous_avatar_code"  TEXT,
  "new_avatar_code"       TEXT,
  "changed_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "changed_by"            TEXT,
  "reason"                TEXT,
  CONSTRAINT "identity_history_identity_id_fkey"
    FOREIGN KEY ("identity_id") REFERENCES "anonymous_identities"("id") ON DELETE CASCADE
);

-- post_audiences
CREATE TABLE IF NOT EXISTS "post_audiences" (
  "id"           TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "post_id"      TEXT        NOT NULL,
  "community_id" TEXT        NOT NULL,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "post_audiences_post_id_fkey"
    FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE,
  CONSTRAINT "post_audiences_community_id_fkey"
    FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "post_audiences_post_id_community_id_key"
  ON "post_audiences" ("post_id", "community_id");

-- attachments
CREATE TABLE IF NOT EXISTS "attachments" (
  "id"               TEXT                   NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "post_id"          TEXT,
  "comment_id"       TEXT,
  "type"             "AttachmentType"       NOT NULL,
  "url"              TEXT                   NOT NULL,
  "thumbnail_url"    TEXT,
  "mime_type"        TEXT,
  "size_bytes"       INTEGER,
  "duration_seconds" DOUBLE PRECISION,
  "status"           "AttachmentStatus"     NOT NULL DEFAULT 'PENDING',
  "scan_status"      "AttachmentScanStatus" NOT NULL DEFAULT 'PENDING',
  "metadata"         JSONB,
  "created_at"       TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  "deleted_at"       TIMESTAMPTZ,
  CONSTRAINT "attachments_post_id_fkey"
    FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE SET NULL,
  CONSTRAINT "attachments_comment_id_fkey"
    FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE SET NULL
);

-- hashtags
CREATE TABLE IF NOT EXISTS "hashtags" (
  "id"         TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "tag"        TEXT        NOT NULL UNIQUE,
  "post_count" INTEGER     NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- post_hashtags
CREATE TABLE IF NOT EXISTS "post_hashtags" (
  "id"         TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "post_id"    TEXT NOT NULL,
  "hashtag_id" TEXT NOT NULL,
  CONSTRAINT "post_hashtags_post_id_fkey"
    FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE,
  CONSTRAINT "post_hashtags_hashtag_id_fkey"
    FOREIGN KEY ("hashtag_id") REFERENCES "hashtags"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "post_hashtags_post_id_hashtag_id_key"
  ON "post_hashtags" ("post_id", "hashtag_id");

-- mentions
CREATE TABLE IF NOT EXISTS "mentions" (
  "id"                    TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "post_id"               TEXT,
  "comment_id"            TEXT,
  "mentioned_identity_id" TEXT        NOT NULL,
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "mentions_post_id_fkey"
    FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE,
  CONSTRAINT "mentions_comment_id_fkey"
    FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE,
  CONSTRAINT "mentions_mentioned_identity_id_fkey"
    FOREIGN KEY ("mentioned_identity_id") REFERENCES "anonymous_identities"("id") ON DELETE CASCADE
);

-- trending_scores
CREATE TABLE IF NOT EXISTS "trending_scores" (
  "id"           TEXT             NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "post_id"      TEXT             NOT NULL UNIQUE,
  "city_slug"    TEXT             NOT NULL,
  "community_id" TEXT,
  "score"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "view_count"   INTEGER          NOT NULL DEFAULT 0,
  "window_start" TIMESTAMPTZ      NOT NULL,
  "window_end"   TIMESTAMPTZ      NOT NULL,
  "updated_at"   TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  CONSTRAINT "trending_scores_post_id_fkey"
    FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "trending_scores_city_slug_score_idx"
  ON "trending_scores" ("city_slug", "score" DESC);
CREATE INDEX IF NOT EXISTS "trending_scores_community_id_score_idx"
  ON "trending_scores" ("community_id", "score" DESC);

-- search_history
CREATE TABLE IF NOT EXISTS "search_history" (
  "id"          TEXT         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "user_id"     TEXT         NOT NULL,
  "query"       TEXT         NOT NULL,
  "search_type" "SearchType" NOT NULL,
  "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "search_history_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- identity_access_logs
CREATE TABLE IF NOT EXISTS "identity_access_logs" (
  "id"            TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "actor_id"      TEXT        NOT NULL,
  "identity_id"   TEXT        NOT NULL,
  "access_reason" TEXT,
  "ip_address"    TEXT,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "identity_access_logs_identity_id_fkey"
    FOREIGN KEY ("identity_id") REFERENCES "anonymous_identities"("id") ON DELETE CASCADE
);

-- retention_policies
CREATE TABLE IF NOT EXISTS "retention_policies" (
  "id"             TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "data_type"      TEXT        NOT NULL,
  "retention_days" INTEGER,
  "legal_basis"    TEXT,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─── otp_challenges table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS "otp_challenges" (
  "id"                 TEXT NOT NULL PRIMARY KEY,
  "identifier"         TEXT NOT NULL,
  "hashed_code"        TEXT NOT NULL,
  "expires_at"         TIMESTAMP(3) NOT NULL,
  "attempts"           INTEGER NOT NULL DEFAULT 0,
  "daily_count"        INTEGER NOT NULL DEFAULT 1,
  "daily_window_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_sent_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "used_at"            TIMESTAMP(3),
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "otp_challenges_identifier_expires_at_idx"
  ON "otp_challenges" ("identifier", "expires_at");
