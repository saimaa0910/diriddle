-- AlterEnum
ALTER TYPE "PostStatus" ADD VALUE 'HIDDEN';

-- DropForeignKey
ALTER TABLE "age_verifications" DROP CONSTRAINT "age_verifications_user_id_fkey";

-- DropForeignKey
ALTER TABLE "attachments" DROP CONSTRAINT "attachments_comment_id_fkey";

-- DropForeignKey
ALTER TABLE "attachments" DROP CONSTRAINT "attachments_post_id_fkey";

-- DropForeignKey
ALTER TABLE "auth_identities" DROP CONSTRAINT "auth_identities_user_id_fkey";

-- DropForeignKey
ALTER TABLE "cities" DROP CONSTRAINT "cities_state_id_fkey";

-- DropForeignKey
ALTER TABLE "communities" DROP CONSTRAINT "communities_owner_id_fkey";

-- DropForeignKey
ALTER TABLE "community_bans" DROP CONSTRAINT "community_bans_banned_by_id_fkey";

-- DropForeignKey
ALTER TABLE "community_bans" DROP CONSTRAINT "community_bans_community_id_fkey";

-- DropForeignKey
ALTER TABLE "community_bans" DROP CONSTRAINT "community_bans_user_id_fkey";

-- DropForeignKey
ALTER TABLE "community_roles" DROP CONSTRAINT "community_roles_community_id_fkey";

-- DropForeignKey
ALTER TABLE "community_roles" DROP CONSTRAINT "community_roles_granted_by_id_fkey";

-- DropForeignKey
ALTER TABLE "community_roles" DROP CONSTRAINT "community_roles_user_id_fkey";

-- DropForeignKey
ALTER TABLE "community_rules" DROP CONSTRAINT "community_rules_community_id_fkey";

-- DropForeignKey
ALTER TABLE "deletion_requests" DROP CONSTRAINT "deletion_requests_user_id_fkey";

-- DropForeignKey
ALTER TABLE "identity_access_logs" DROP CONSTRAINT "identity_access_logs_identity_id_fkey";

-- DropForeignKey
ALTER TABLE "identity_history" DROP CONSTRAINT "identity_history_identity_id_fkey";

-- DropForeignKey
ALTER TABLE "join_requests" DROP CONSTRAINT "join_requests_community_id_fkey";

-- DropForeignKey
ALTER TABLE "join_requests" DROP CONSTRAINT "join_requests_reviewed_by_id_fkey";

-- DropForeignKey
ALTER TABLE "join_requests" DROP CONSTRAINT "join_requests_user_id_fkey";

-- DropForeignKey
ALTER TABLE "login_history" DROP CONSTRAINT "login_history_user_id_fkey";

-- DropForeignKey
ALTER TABLE "mentions" DROP CONSTRAINT "mentions_comment_id_fkey";

-- DropForeignKey
ALTER TABLE "mentions" DROP CONSTRAINT "mentions_mentioned_identity_id_fkey";

-- DropForeignKey
ALTER TABLE "mentions" DROP CONSTRAINT "mentions_post_id_fkey";

-- DropForeignKey
ALTER TABLE "post_audiences" DROP CONSTRAINT "post_audiences_community_id_fkey";

-- DropForeignKey
ALTER TABLE "post_audiences" DROP CONSTRAINT "post_audiences_post_id_fkey";

-- DropForeignKey
ALTER TABLE "post_hashtags" DROP CONSTRAINT "post_hashtags_hashtag_id_fkey";

-- DropForeignKey
ALTER TABLE "post_hashtags" DROP CONSTRAINT "post_hashtags_post_id_fkey";

-- DropForeignKey
ALTER TABLE "search_history" DROP CONSTRAINT "search_history_user_id_fkey";

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "spatial_cells" DROP CONSTRAINT "spatial_cells_city_id_fkey";

-- DropForeignKey
ALTER TABLE "states" DROP CONSTRAINT "states_country_id_fkey";

-- DropForeignKey
ALTER TABLE "temporary_user_gps" DROP CONSTRAINT "temporary_user_gps_user_id_fkey";

-- DropForeignKey
ALTER TABLE "trending_scores" DROP CONSTRAINT "trending_scores_post_id_fkey";

-- DropForeignKey
ALTER TABLE "user_profiles" DROP CONSTRAINT "user_profiles_user_id_fkey";

-- AlterTable
ALTER TABLE "age_verifications" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "verified_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "attachments" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "auth_identities" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "verified_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "cities" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "activated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "community_bans" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "banned_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "community_roles" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "granted_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "revoked_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "community_rules" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "countries" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "deletion_requests" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "requested_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "scheduled_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "cancelled_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "executed_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "hashtags" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "identity_access_logs" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "identity_history" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "changed_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "join_requests" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "location_preferences" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "login_history" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "mentions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "notification_preferences" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "post_audiences" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "post_hashtags" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "posts" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "reports" ALTER COLUMN "evidence_urls" DROP DEFAULT;

-- AlterTable
ALTER TABLE "retention_policies" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "search_history" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "sessions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "last_active_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "revoked_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "spatial_cells" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "states" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "temporary_user_gps" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "captured_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "trending_scores" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "window_start" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "window_end" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "user_profiles" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "comment_reactions" (
    "id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reaction_type" "ReactionType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comment_reactions_comment_id_idx" ON "comment_reactions"("comment_id");

-- CreateIndex
CREATE UNIQUE INDEX "comment_reactions_comment_id_user_id_key" ON "comment_reactions"("comment_id", "user_id");

-- CreateIndex
DROP INDEX IF EXISTS "anonymous_identities_user_id_community_id_key";
CREATE UNIQUE INDEX "anonymous_identities_user_id_community_id_key" ON "anonymous_identities"("user_id", "community_id");

-- CreateIndex
CREATE INDEX "posts_community_id_status_created_at_idx" ON "posts"("community_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "posts_category_status_created_at_idx" ON "posts"("category", "status", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "communities" ADD CONSTRAINT "communities_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_history" ADD CONSTRAINT "login_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "age_verifications" ADD CONSTRAINT "age_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "states" ADD CONSTRAINT "states_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spatial_cells" ADD CONSTRAINT "spatial_cells_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temporary_user_gps" ADD CONSTRAINT "temporary_user_gps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_rules" ADD CONSTRAINT "community_rules_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_bans" ADD CONSTRAINT "community_bans_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_bans" ADD CONSTRAINT "community_bans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_bans" ADD CONSTRAINT "community_bans_banned_by_id_fkey" FOREIGN KEY ("banned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_roles" ADD CONSTRAINT "community_roles_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_roles" ADD CONSTRAINT "community_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_roles" ADD CONSTRAINT "community_roles_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_history" ADD CONSTRAINT "identity_history_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "anonymous_identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_audiences" ADD CONSTRAINT "post_audiences_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_audiences" ADD CONSTRAINT "post_audiences_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_hashtags" ADD CONSTRAINT "post_hashtags_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_hashtags" ADD CONSTRAINT "post_hashtags_hashtag_id_fkey" FOREIGN KEY ("hashtag_id") REFERENCES "hashtags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_mentioned_identity_id_fkey" FOREIGN KEY ("mentioned_identity_id") REFERENCES "anonymous_identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trending_scores" ADD CONSTRAINT "trending_scores_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_access_logs" ADD CONSTRAINT "identity_access_logs_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "anonymous_identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "audit_logs_resource_created_idx" RENAME TO "audit_logs_resource_type_resource_id_created_at_idx";

-- RenameIndex
ALTER INDEX "comments_post_status_created_idx" RENAME TO "comments_post_id_status_created_at_idx";

-- RenameIndex
ALTER INDEX "moderation_actions_target_idx" RENAME TO "moderation_actions_target_type_target_id_idx";

-- RenameIndex
ALTER INDEX "moderation_appeals_status_created_idx" RENAME TO "moderation_appeals_status_created_at_idx";

-- RenameIndex
ALTER INDEX "notifications_user_read_created_idx" RENAME TO "notifications_user_id_read_at_created_at_idx";

-- RenameIndex
ALTER INDEX "reports_status_priority_created_idx" RENAME TO "reports_status_priority_created_at_idx";

