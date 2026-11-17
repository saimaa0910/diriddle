ALTER TABLE "anonymous_identities" ADD CONSTRAINT "anonymous_identities_community_id_display_code_key" UNIQUE ("community_id", "display_code");
