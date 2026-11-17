# diriddle — 12-Week Engineering & Delivery Roadmap

> **Delivery Model**: Solo developer executing **6 × 2-week sprints** (12 weeks total).  
> **Committed MVP Scope**: `30` issues = **86 story points** (`14–15` pts/sprint).  
> **Post-Selection / Fast-Follow Backlog**: `28` issues = **102 story points** (tracked under `Release 1.0 – MVP` backlog in [`github-import/issues.csv`](./github-import/issues.csv)).  
> **Source of Truth**: [`PRODUCT_BACKLOG.md`](./PRODUCT_BACKLOG.md), [`EPICS_AND_USER_STORIES.md`](./EPICS_AND_USER_STORIES.md), and [`github-import/milestones.json`](./github-import/milestones.json).

---

## 1. Executive Overview & Velocity Assumptions

Because one engineer owns the full `diriddle` stack—NestJS API (`apps/api`), Expo React Native + Windows Web (`apps/mobile`), Next.js Admin Console (`apps/admin`), PostgreSQL/PostGIS/Redis, CI/CD, and AWS `ap-south-1` infrastructure—committed sprint capacity is deliberately capped at **14–15 story points per 2-week sprint** (see [`SPRINT_PLANNING.md`](./SPRINT_PLANNING.md) for the full capacity & overhead model).

### Delivery Strategy across the 12 Weeks
1. **Weeks 1–4 (`Release 0.1 – Engineering Alpha`)**: Eliminate P0 security holes (`JWT_SECRET` fail-closed, `AdminRole.expiresAt`, 18+ `AgeVerifiedGuard`), fix broken mobile/admin contract mismatches, enforce Git LF / Prettier / ESLint hygiene, and stand up a **real Docker PostgreSQL + PostGIS + Redis** integration suite.
2. **Weeks 5–8 (`Release 0.2 – Feature Alpha`)**: Replace in-memory/dev auth & rate-limiting with Supabase OTP + Redis, add mobile automatic 401 refresh, enforce real Postgres CI on every PR, and implement PostGIS + `h3-js` coarse geo-cells with `>= 20` active users k-anonymity.
3. **Weeks 9–10 (`Release 0.3 – Safety Beta`)**: Complete DPDP-compliant account deletion scrubbing, anonymous-safe author blocking (zero `user_id` leakage), and wire the Admin Console (`apps/admin`) to real `/v1/admin/*` endpoints with `reporter_id` stripped and role-gated UI controls.
4. **Weeks 11–12 (`Release 0.9 – Release Candidate` → `Release 1.0 – MVP`)**: Provision Terraform AWS `ap-south-1` infrastructure, deploy gated production CD with rollback, run pre-launch security/privacy penetration checks, verify RDS PITR restore DR drill, build EAS Android/iOS/Web release artifacts with a 48h staging soak, and execute the Go/No-Go sign-off.

---

## 2. Visual 12-Week Roadmap (Gantt)

```mermaid
gantt
    title diriddle 12-Week Solo-Developer Delivery Roadmap (86 Committed Pts)
    dateFormat  YYYY-MM-DD
    axisFormat  %b %d

    section Sprint 1 (14 pts) - Alpha Foundation
    DIR-041 Fail-closed JWT secrets           :crit, s1a, 2026-11-16, 2d
    DIR-038 AdminRole.expiresAt in RolesGuard :crit, s1b, 2026-11-16, 3d
    DIR-003 .gitattributes & 49 CRLF cleanup  :s1c, 2026-11-18, 2d
    DIR-001 Prettier 126 files & format check :s1d, 2026-11-20, 2d
    DIR-004 Align AdminRoleType enum          :s1e, 2026-11-22, 2d
    DIR-007 Mobile verify-age & login routing :s1f, 2026-11-24, 2d
    DIR-030 Mobile PATCH notification read    :s1g, 2026-11-26, 2d

    section Sprint 2 (14 pts) - Release 0.1 Gate
    DIR-002 Real ESLint for mobile & api      :s2a, 2026-11-30, 3d
    DIR-012 18+ AgeVerifiedGuard on writes    :crit, s2b, 2026-12-02, 3d
    DIR-013 Fix Anonymous #XXXX collision     :crit, s2c, 2026-12-05, 3d
    DIR-044 Real Postgres/PostGIS/Redis tests :crit, s2d, 2026-12-07, 5d
    Milestone Release 0.1 Engineering Alpha   :milestone, m1, 2026-12-11, 0d

    section Sprint 3 (14 pts) - Auth & Real CI
    DIR-008 Supabase OTP & ALLOW_DEV_OTP gate :crit, s3a, 2026-12-14, 5d
    DIR-009 Redis OTP limiter & revokedJtis   :crit, s3b, 2026-12-18, 3d
    DIR-010 Mobile 401 refresh interceptor    :s3c, 2026-12-21, 3d
    DIR-049 Real Postgres + format:check CI   :crit, s3d, 2026-12-23, 3d

    section Sprint 4 (15 pts) - Release 0.2 Gate
    DIR-015 PostGIS & h3-js geo-cells         :crit, s4a, 2026-12-28, 5d
    DIR-016 k-Anonymity >= 20 users threshold :crit, s4b, 2027-01-01, 3d
    DIR-021 Atomic Post/Poll/Idempotency tx   :s4c, 2027-01-04, 3d
    DIR-027 Mobile feed/category/:category    :s4d, 2027-01-06, 2d
    DIR-034 Appeal subject ownership check    :s4e, 2027-01-07, 2d
    Milestone Release 0.2 Feature Alpha       :milestone, m2, 2027-01-08, 0d

    section Sprint 5 (14 pts) - Release 0.3 Gate
    DIR-011 DPDP account deletion scrubbing   :crit, s5a, 2027-01-11, 3d
    DIR-033 Anonymous-safe author blocking    :crit, s5b, 2027-01-14, 3d
    DIR-036 Wire Admin Console to real API    :crit, s5c, 2027-01-16, 5d
    DIR-037 Strip reporter_id & role UI gates :crit, s5d, 2027-01-20, 3d
    Milestone Release 0.3 Safety Beta         :milestone, m3, 2027-01-22, 0d

    section Sprint 6 (15 pts) - RC & MVP Launch
    DIR-051 Terraform AWS ap-south-1 IaC      :crit, s6a, 2027-01-25, 4d
    DIR-052 Gated deploy-production.yml       :crit, s6b, 2027-01-28, 3d
    DIR-053 Pre-launch security pen checklist :crit, s6c, 2027-01-31, 2d
    Milestone Release 0.9 Release Candidate   :milestone, m4, 2027-02-01, 0d
    DIR-054 RDS PITR backups & DR drill       :crit, s6d, 2027-02-02, 2d
    DIR-055 EAS builds & 48h staging soak     :s6e, 2027-02-03, 2d
    DIR-056 Incident runbooks & Go/No-Go      :crit, s6f, 2027-02-05, 1d
    Milestone Release 1.0 MVP                 :milestone, m5, 2027-02-05, 0d
```

---

## 3. Milestone Gates Summary

| Milestone | Target Window | Sprints | Committed Issues | Committed Pts | Primary Gate |
|---|---|---|---|---|---|
| **`Release 0.1 – Engineering Alpha`** | Weeks 1–4 | Sprints 1–2 | 11 (`DIR-001`..`DIR-004`, `DIR-007`, `DIR-012`, `DIR-013`, `DIR-030`, `DIR-038`, `DIR-041`, `DIR-044`) | **28** | Clean formatting/lint/typecheck, fail-closed JWT & 18+ guard, real Postgres/PostGIS/Redis tests passing |
| **`Release 0.2 – Feature Alpha`** | Weeks 5–8 | Sprints 3–4 | 9 (`DIR-008`, `DIR-009`, `DIR-010`, `DIR-015`, `DIR-016`, `DIR-021`, `DIR-027`, `DIR-034`, `DIR-049`) | **29** | Real Supabase OTP + Redis auth state, mobile token refresh, PostGIS/`h3-js` k-anonymity, Postgres CI green |
| **`Release 0.3 – Safety Beta`** | Weeks 9–10 | Sprint 5 | 4 (`DIR-011`, `DIR-033`, `DIR-036`, `DIR-037`) | **14** | DPDP account erasure, anonymous-safe blocking, live Admin Console with zero `reporter_id` leaks |
| **`Release 0.9 – Release Candidate`** | Week 11 | Sprint 6 (Part 1) | 3 (`DIR-051`, `DIR-052`, `DIR-053`) | **10** | Terraform AWS `ap-south-1` live, gated prod CD workflow, security penetration checklist signed off |
| **`Release 1.0 – MVP`** | Week 12 | Sprint 6 (Part 2) | 3 committed (`DIR-054`, `DIR-055`, `DIR-056`) + 28 backlog | **5** (+102 backlog) | RDS PITR restore drill passed, EAS Android/iOS/Web soak clean, Go/No-Go approved |

---

## 4. Detailed Sprint Breakdown (Sprints 1–6)

### Sprint 1 (Weeks 1–2) — Security Foundation, Repo Hygiene & P0 API Contract Fixes
- **Target Milestone**: `Release 0.1 – Engineering Alpha`
- **Committed Points**: **14 pts** (7 issues)
- **Sprint Goal**: Eliminate critical JWT/RBAC security gaps, normalize Git line endings and Prettier formatting across all workspaces, align `AdminRoleType`, and fix immediate mobile P0 404/method mismatches.
- **Committed Issues**:
  - `DIR-041` (`P0`, 2 pts) — Remove hardcoded `dev-secret` JWT fallbacks and fail closed on missing secrets
  - `DIR-038` (`P0`, 3 pts) — Enforce `AdminRole.expiresAt` in `RolesGuard`
  - `DIR-003` (`P2`, 1 pt) — Resolve 49 CRLF/newline dirty files in `apps/mobile` and enforce `.gitattributes` LF
  - `DIR-001` (`P1`, 2 pts) — Fix Prettier formatting across 126 files and enforce `format:check` in CI
  - `DIR-004` (`P1`, 2 pts) — Align `AdminRoleType` enum across `@diriddle/shared-types`, `apps/api`, and `apps/admin`
  - `DIR-007` (`P0`, 2 pts) — Fix mobile age-verification endpoint mismatch (`/auth/verify-age`) and login `age_verified` routing
  - `DIR-030` (`P0`, 2 pts) — Fix mobile mark-notification-read HTTP method (`POST` -> `PATCH /v1/notifications/:id/read`)
- **Key Deliverables**:
  - `.gitattributes` committed and `git status` clean across all 49 mobile files.
  - `pnpm run format:check` exits `0` across all workspaces.
  - Single canonical `AdminRoleType` enum exported by `@diriddle/shared-types` and consumed by Prisma + `apps/api` + `apps/admin`.
  - API startup fails fast when `JWT_SECRET` / `JWT_REFRESH_SECRET` are unset in production.
- **Exit Criteria**:
  - `pnpm run format:check`, `pnpm run typecheck`, `pnpm run build`, and existing unit/E2E tests all pass.
  - Unit tests cover `RolesGuard` expired role denial (`403 ADMIN_ROLE_EXPIRED`) and missing-secret startup failure.

---

### Sprint 2 (Weeks 3–4) — Real Linting, 18+ & Anonymity Guards, Real Postgres Test Harness
- **Target Milestone**: `Release 0.1 – Engineering Alpha` (Milestone Gate)
- **Committed Points**: **14 pts** (4 issues)
- **Sprint Goal**: Replace silent lint stubs with real ESLint enforcement, seal the 18+ age-verification bypass and concurrent `Anonymous #XXXX` collision bug, and prove all SQL/PostGIS constraints against real Docker PostgreSQL + Redis.
- **Committed Issues**:
  - `DIR-002` (`P1`, 3 pts) — Configure real ESLint for `apps/mobile` and `apps/api` (remove `|| echo lint-ok` and `echo ok`)
  - `DIR-012` (`P0`, 3 pts) — Enforce 18+ `ageVerified` guard on post, comment, reaction, and report write endpoints
  - `DIR-013` (`P0`, 3 pts) — Fix concurrent `Anonymous #XXXX` `displayCode` collision risk (`(community_id, display_code)` uniqueness + retry)
  - `DIR-044` (`P0`, 5 pts) — Add real PostgreSQL + PostGIS + Redis integration test suite (`jest.pg.config.js`)
- **Key Deliverables**:
  - Real `.eslintrc.json` enforced in `apps/api` and `apps/mobile` (`--max-warnings 0`).
  - `AgeVerifiedGuard` returning `403 AGE_VERIFICATION_REQUIRED` for unverified users.
  - Real `docker-compose.test.yml` integration suite running `prisma migrate deploy`, `seed.ts`, and SQL constraint assertions (`blocks_no_self_block`, partial unique indexes).
- **Exit Criteria (`Release 0.1 – Engineering Alpha` Gate)**:
  - `pnpm run lint`, `pnpm run format:check`, `pnpm run typecheck`, `pnpm run build`, `test`, `test:e2e`, and `test:pg` all pass with zero skipped assertions.

---

### Sprint 3 (Weeks 5–6) — Production Auth (Supabase + Redis), Token Refresh & Postgres CI
- **Target Milestone**: `Release 0.2 – Feature Alpha`
- **Committed Points**: **14 pts** (4 issues)
- **Sprint Goal**: Move authentication security state out of process memory into Supabase Auth + Redis, enable seamless 15-minute access token refresh in mobile, and upgrade GitHub Actions CI to run real PostgreSQL/PostGIS/Redis integration tests.
- **Committed Issues**:
  - `DIR-008` (`P0`, 5 pts) — Integrate Supabase Auth OTP delivery and gate dev OTP `123456` behind explicit test flag (`ALLOW_DEV_OTP=true`)
  - `DIR-009` (`P0`, 3 pts) — Move `OtpRateLimiterService` and JWT refresh revocation (`revokedJtis`) to Redis
  - `DIR-010` (`P0`, 3 pts) — Add Axios 401 refresh-token interceptor and expired-session recovery in `apps/mobile`
  - `DIR-049` (`P0`, 3 pts) — Update `.github/workflows/ci.yml` to run real PostgreSQL/PostGIS tests and `format:check`
- **Key Deliverables**:
  - `RedisModule` / `RedisService` backing OTP lockouts and `revokedJtis` TTL keys across restarts.
  - Single-flight 401 refresh queue in `apps/mobile/src/api/client.ts`.
  - GitHub Actions CI provisioning `postgis/postgis` and `redis` service containers on every PR.
- **Exit Criteria**:
  - Hardcoded `123456` OTP rejected unless `ALLOW_DEV_OTP=true && NODE_ENV !== 'production'`.
  - CI pipeline runs `format:check`, `lint`, `typecheck`, `test`, `test:e2e`, and real Postgres `test:pg` cleanly.

---

### Sprint 4 (Weeks 7–8) — Geospatial Privacy (`h3-js`/PostGIS), Atomic Writes & Core Feed Fixes
- **Target Milestone**: `Release 0.2 – Feature Alpha` (Milestone Gate)
- **Committed Points**: **15 pts** (5 issues)
- **Sprint Goal**: Deliver true PostGIS + `h3-js` coarse geospatial discovery with `>= 20` active users k-anonymity, transactional post/poll creation, accurate category feed routing, and appeal ownership checks.
- **Committed Issues**:
  - `DIR-015` (`P0`, 5 pts) — Implement PostGIS spatial columns and `h3-js` coarse geo-cell resolution
  - `DIR-016` (`P0`, 3 pts) — Enforce `checkLocationPrivacyThreshold` (k-anonymity `>= 20` users) in location & feed APIs
  - `DIR-021` (`P0`, 3 pts) — Wrap `Post`, `Poll`, `PollOption`, and `IdempotencyKey` creation in `PrismaService.$transaction`
  - `DIR-027` (`P0`, 2 pts) — Fix mobile category feed filtering to call `GET /v1/feed/category/:category`
  - `DIR-034` (`P0`, 2 pts) — Enforce subject ownership check in `ModerationController.submitAppeal`
- **Key Deliverables**:
  - `communities.center_point` geography + GIST index migration and `ST_DWithin` nearby feed query.
  - Sparse geo-cell (`< 20` active users) automatic fallback to city-level feed scope.
  - Atomic post + poll + idempotency persistence tested against real PostgreSQL.
- **Exit Criteria (`Release 0.2 – Feature Alpha` Gate)**:
  - Verified against real PostGIS that zero exact GPS coordinates are stored and `< 20` user cells never expose neighborhood granularity.

---

### Sprint 5 (Weeks 9–10) — DPDP Erasure, Anonymous Blocking & Live Admin Console
- **Target Milestone**: `Release 0.3 – Safety Beta` (Milestone Gate)
- **Committed Points**: **14 pts** (4 issues)
- **Sprint Goal**: Complete Trust, Safety & Privacy readiness across mobile, backend, and admin console before production infrastructure provisioning.
- **Committed Issues**:
  - `DIR-011` (`P0`, 3 pts) — Complete DPDP-compliant account deletion scrubbing `Posts`, `Comments`, and `AdminRoles`
  - `DIR-033` (`P0`, 3 pts) — Enable anonymous-safe author blocking from post/comment context without exposing `user_id`
  - `DIR-036` (`P0`, 5 pts) — Wire `apps/admin` `api-client.ts` to real `/v1/admin/*` endpoints, mappers, and OTP login
  - `DIR-037` (`P0`, 3 pts) — Strip `reporter_id` from `AdminService.getReports` and gate Admin UI controls by role
- **Key Deliverables**:
  - Transactional `DELETE /v1/users/me` erasing user content, saved posts, device tokens, admin roles, and revoking sessions.
  - Server-resolved anonymous block endpoint (`target_type` / `target_id`) ensuring `user_id` is never serialized in public payloads.
  - Live `apps/admin` console authenticated via real `/v1/auth/*` OTP JWTs with snake_case->camelCase mappers and role-gated UI controls.
- **Exit Criteria (`Release 0.3 – Safety Beta` Gate)**:
  - Full moderation lifecycle (report -> triage -> action -> appeal -> audit log -> anonymous block -> account deletion) verified end-to-end against live NestJS + PostgreSQL.

---

### Sprint 6 (Weeks 11–12) — AWS Provisioning, Production CD, Security Audit & MVP Launch
- **Target Milestones**: `Release 0.9 – Release Candidate` (10 pts) & `Release 1.0 – MVP` (5 pts)
- **Committed Points**: **15 pts** (6 issues)
- **Sprint Goal**: Stand up reproducible AWS `ap-south-1` infrastructure, automate gated production deployment, verify security/privacy & DR readiness, soak-test EAS builds, and execute MVP launch.
- **Committed Issues**:
  - **Release 0.9 – Release Candidate (10 pts)**:
    - `DIR-051` (`P1`, 5 pts) — Create Terraform AWS IaC (`infrastructure/terraform/`) for `ap-south-1`
    - `DIR-052` (`P1`, 3 pts) — Create `.github/workflows/deploy-production.yml` with approval gate, migrations, and rollback
    - `DIR-053` (`P0`, 2 pts) — Execute pre-launch security & privacy penetration checklist
  - **Release 1.0 – MVP (5 pts)**:
    - `DIR-054` (`P0`, 2 pts) — Configure automated RDS backups, PITR verification, and restore DR drill
    - `DIR-055` (`P1`, 2 pts) — Build EAS Android/iOS release artifacts, configure store metadata, and run staging soak test
    - `DIR-056` (`P0`, 1 pt) — Publish incident response runbooks, monitoring alerts, and execute `Release 1.0` Go/No-Go
- **Exit Criteria (`Release 0.9` & `Release 1.0` Gates)**:
  - Production stack deployed cleanly via Terraform + `deploy-production.yml`; PITR restore drill timed and passed; 48h staging soak clean; security checklist and Go/No-Go signed off.

---

## 5. Post-12-Week / Stretch Product Backlog (28 Issues — 102 Points)

To preserve a realistic solo-developer velocity (`14–15` pts/sprint), the following **28 issues (`102` pts)** remain prioritized in the **Product Backlog** (`Sprint = Backlog`, `Milestone = Release 1.0 – MVP` in [`github-import/issues.csv`](./github-import/issues.csv)) for post-W12 sprints or accelerated scope substitution if velocity exceeds 15 pts/sprint:

| Area / Theme | Issue IDs | Count | Total Pts | Notes |
|---|---|---|---|---|
| **Contracts, SDK & Observability** | `DIR-005` (3), `DIR-006` (5), `DIR-050` (3) | 3 | **11** | `openapi.yaml` 1:1 sync, Expo/React 18 alignment, Pino/OTel/Sentry |
| **Mobile Live API Wiring & UX** | `DIR-014` (2), `DIR-017` (3), `DIR-018` (2), `DIR-020` (2), `DIR-024` (2), `DIR-035` (5) | 6 | **16** | Live identities, location-setup, UUID communities, Profile/delete/appeals UI |
| **Rich Content, Search & Push** | `DIR-022` (5), `DIR-023` (5), `DIR-028` (2), `DIR-029` (3), `DIR-031` (5), `DIR-032` (2) | 6 | **22** | S3 media, Polls UI, cursor tie-breaker + search, FCM/APNs & live Activity |
| **Realtime Scale & Safety Depth** | `DIR-025` (5), `DIR-026` (3), `DIR-039` (5), `DIR-040` (5), `DIR-042` (3), `DIR-043` (5), `DIR-058` (5) | 7 | **31** | Redis Socket.IO + block filter, Hinglish/velocity moderation, Admin SSR cookies, `@Throttle`, DPDP legal/SOPs, `scopeId` |
| **Extended QA, Load & A11y** | `DIR-019` (3), `DIR-045` (3), `DIR-046` (3), `DIR-047` (5), `DIR-048` (3), `DIR-057` (5) | 6 | **22** | Admin create community, Admin Playwright, Mobile integration/Maestro/a11y, k6 load tests |
| **Total Post-12-Week Backlog** | **All 28 Backlog Issues** | **28** | **102** | Ready for Sprint 7+ prioritization |
