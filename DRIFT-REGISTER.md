# Drift Register

Tracks known discrepancies between architecture/PRD claims and current implementation reality across the `diriddle` monorepo.

| ID | Area | Claim | Reality | Evidence | Severity | Affected repos | Owner level | Recommended action | Status | Last verified |
|---|---|---|---|---|---|---|---|---|---|---|
| DR-001 | Auth / OTP | OTP delivery via Supabase Auth SMS/Email in production | Local & Windows test mode uses dev OTP (`123456`) and optional `DEV_IN_MEMORY=true` when Supabase credentials or Docker are absent | `apps/api/src/auth/auth.service.ts` | Medium | `apps/api`, `apps/mobile` | L1 | Wire live Supabase Auth provider credentials before staging/prod deploy | Open | 2026-11-12 |
| DR-002 | Location / Geo | H3 hexagonal coarse geo-cells & PostGIS spatial queries | City/neighborhood selection and coarse cell abstraction stubbed; PostGIS extension enabled in initial SQL migration | `apps/api/prisma/migrations/0001_init/migration.sql` | Low | `apps/api`, `apps/mobile` | L1 | Add PostGIS spatial radius index and H3 cell binning in Phase 2 | Open | 2026-11-12 |
| DR-003 | Windows Testing | Mobile app targets iOS/Android first | Windows-first testing enabled via Expo Web (`react-native-web`) on `http://localhost:8081` with web-safe storage/location fallbacks | `scripts/start-windows-test.ps1`, `apps/mobile/package.json` | Low | `apps/mobile`, `scripts` | L0 | Maintain web-safe Platform guards for all new native modules | Mitigated | 2026-11-12 |
