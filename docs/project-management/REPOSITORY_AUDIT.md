# Repository Audit — `diriddle`

**Audit Date**: 2026-11-12
**Repository**: `c:\Users\admin\Desktop\diriddle` (`main` @ `c4a0a86`)
**Scope**: Full monorepo codebase, database schema/migrations, OpenAPI contracts, mobile/web/admin clients, tests, CI/CD, Docker, and governance docs.

---

## 1. Executive Summary & Audit Methodology

The `diriddle` repository is a functional pnpm@9 + Turborepo v2 monorepo implementing an anonymous, location-based social network for India. Core scaffolding, Prisma schema, NestJS modular monolith API (with `DEV_IN_MEMORY=true` fallback), Expo React Native / Windows Web app, Next.js 15 Admin Dashboard, Docker Compose stacks, and GitHub Actions CI workflows are in place and build cleanly.

However, cross-workspace contract verification reveals **critical integration gaps between frontend clients and the real NestJS backend**, **mocked production dependencies** (Supabase Auth, Redis adapters, PostGIS spatial queries, S3 uploads, FCM/APNs push), **missing production security hardening** (hardcoded `'dev-secret'` JWT fallbacks, unchecked `adminRole.expiresAt`, missing 18+ `ageVerified` guard on write endpoints, `reporter_id` exposed in admin reports), **zero real PostgreSQL integration tests**, **zero Admin Dashboard tests**, and **missing cloud IaC / production CD / observability**.

### Classification Rubric

| Status | Meaning |
|---|---|
| `IMPLEMENTED` | Built, wired end-to-end, and verified against tests/builds |
| `PARTIALLY IMPLEMENTED` | Core scaffold or happy path exists, but relies on in-memory/demo fallbacks, stubs, or misses key PRD features |
| `MISSING` | Not yet implemented in codebase or infrastructure |
| `NEEDS TESTING` | Code exists, but lacks automated unit, integration, or E2E verification against real services |
| `TECHNICAL DEBT` | Works temporarily, but contains contract drift, version skew, dirty state, or maintainability hazards |

---

## 2. Full Repository & Monorepo Inventory

| Area | Path | Key Contents |
|---|---|---|
| **Root Configs** | `/` | `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.eslintrc.base.json`, `.prettierrc`, `.gitignore`, `pnpm-lock.yaml`, `context.yaml`, `DRIFT-REGISTER.md`, `CHANGE-MATRIX.md`, `README.md` |
| **Shared Types** | `packages/shared-types/` | `src/index.ts` (14 enums, 13 DTO/event interfaces), compiled `dist/`, `tsconfig.json`, `package.json` |
| **API Contracts** | `packages/api-contracts/` | `openapi.yaml` (37 paths, 44 operations, 30 schemas; `ErrorEnvelope`, `BearerAuth`), `package.json` |
| **Backend API** | `apps/api/` | NestJS 10 (`src/main.ts` global `/v1` prefix, Swagger `/docs`), 16 feature modules + `database` + `common`, 24 Prisma models, SQL migration `0001_init`, `seed.ts`, 7 unit spec files + 1 Supertest e2e suite |
| **Mobile / Windows Web** | `apps/mobile/` | Expo ~53 (`expo@53.0.27`), `expo-router@4.0.22`, `react@18.3.1`, `react-native@0.76.3`, `react-native-web@~0.19.13`, 17 route files (14 PRD screens), 5 UI components, Zustand stores, 4 Jest suites |
| **Admin Dashboard** | `apps/admin/` | Next.js `^15.1.0`, React `^19.0.0`, Tailwind `^3.4.17`, login + 9 dashboard pages, 4 UI components, `api-client.ts` + `demo-data.ts`, 0 tests |
| **Docker & Scripts** | `infrastructure/docker/`, `scripts/` | `docker-compose.dev.yml` (PostGIS 16-3.4:5432, Redis 7.2:6379), `docker-compose.test.yml` (5433/6380), `Dockerfile.api`, `start-windows-test.ps1`, `start-windows-test.bat` |
| **CI/CD & Docs** | `.github/`, `docs/` | `workflows/{ci.yml,pr-validation.yml,deploy-staging.yml}`, `ISSUE_TEMPLATE/*`, `PULL_REQUEST_TEMPLATE.md`, `CODEOWNERS`, `docs/{development-workflow,code-review-guidelines,qa-process,release-management,definition-of-done}.md` |

---

## 3. Baseline Verification Results (Observed)

| Check / Tool | Command | Exit Code | Observed Result & Notes |
|---|---|---|---|
| **Typecheck** | `pnpm run typecheck` | `0` | 6/6 Turborepo tasks passed |
| **Lint** | `pnpm run lint` | `0` | `@diriddle/admin` passed (0 errors); `@diriddle/shared-types` runs `tsc --noEmit`; `@diriddle/api` & `api-contracts` run `echo ok`; `@diriddle/mobile` fails ESLint (no config) and masks exit code with `\|\| echo lint-ok` |
| **Formatting** | `pnpm run format:check` | `1` | **FAILED** — Prettier reported style issues in **126 files** |
| **API Unit Tests** | `pnpm --filter @diriddle/api test` | `0` | 7/7 suites, 22/22 tests passed (all in-memory/mocked) |
| **API E2E Tests** | `pnpm --filter @diriddle/api test:e2e` | `0` | 1/1 suite (`test/app.e2e-spec.ts`), 7/7 tests passed (`DEV_IN_MEMORY=true`) |
| **Mobile Tests** | `pnpm --filter @diriddle/mobile test` | `0` | 4/4 suites, 11/11 tests passed |
| **Admin Tests** | `apps/admin/package.json` | N/A | **0 tests** — no `test` script or `*spec*`/`*test*` files exist |
| **Workspace Build** | `pnpm run build` | `0` | 5/5 tasks passed: API `nest build`, Admin `next build` (14 static pages), Mobile `expo export --platform web` (913 modules) |
| **Local Tooling** | `docker info` / `gh --version` | `0` / err | Docker Desktop `29.7.2` + Compose `v5.4.0` running; `gh` CLI **not installed** |

---

## 4. Component-by-Component Audit Matrix (23 Areas)

| # | Area | Status | Evidence & Remaining Gap |
|---|---|---|---|
| 1 | **Root Config & Docs** | `IMPLEMENTED` | Root configs, governance files, and 5 SDLC docs exist; missing `docs/project-management/*` (being added in Wave A/B) and `docs/legal/` SOPs. |
| 2 | **Package Managers & Deps** | `TECHNICAL DEBT` | `pnpm@9.15.9` + `turbo@2.3.0` work, but `apps/mobile` has `expo@53` vs `react@18.3.1` skew requiring `metro.config.js` / `tsconfig.json` / `jest.config.js` workarounds and explicit `query-string`. |
| 3 | **Backend NestJS Architecture** | `IMPLEMENTED` | 16 modular monolith domains + `database` + `common` cleanly wired with `ValidationPipe`, `GlobalExceptionFilter`, Helmet, compression, CORS, Swagger `/docs`. |
| 4 | **Mobile Expo Architecture** | `PARTIALLY IMPLEMENTED` | All 14 PRD screens exist and export cleanly for Windows Web (`:8081`), but `lint` is masked, several API endpoints mismatch backend, and P1/P2 UIs (Polls, Media, Appeals, Push) are missing. |
| 5 | **Admin Next.js Dashboard** | `PARTIALLY IMPLEMENTED` | All 9 dashboard views + login exist with dark theme tokens, but auth/API contracts mismatch `apps/api` causing silent Demo Mode fallback, and test coverage is 0%. |
| 6 | **DB Schema, Migrations & Seed** | `PARTIALLY IMPLEMENTED` | 24 models + 15 enums in `schema.prisma`; `0001_init` enables `postgis` + partial indexes + self-block CHECK; `seed.ts` seeds 10 cities, 8 neighborhoods/campuses, 1 demo admin, 5 posts. Missing PostGIS `boundary` geometry column and unique `(communityId, displayCode)` constraint. |
| 7 | **API Routes & OpenAPI Contracts** | `TECHNICAL DEBT` | `apps/api` exposes 60+ routes across `/v1`; `openapi.yaml` has 37 paths / 44 ops and is missing `/auth/verify-age`, `/feed/category/:category`, `/identities/*`, `/location/*`, `/moderation/*`, `/notifications/device-tokens`, `/posts/me/*`, `/posts/:id/poll/vote`, and 9 `/admin/*` endpoints (while listing unimplemented `/feed/categories`). `AdminRoleType` differs across `shared-types`, `api`, and `admin`. |
| 8 | **Authentication & Session** | `PARTIALLY IMPLEMENTED` | Real JWT issuance/rotation/revocation in DB; however `revokedJtis` is in-memory only, `JWT_SECRET` falls back to `'dev-secret'`, Admin login endpoint `/admin/auth/login` does not exist, and Mobile lacks 401 refresh interceptor. |
| 9 | **OTP Verification** | `PARTIALLY IMPLEMENTED` | `send-otp` / `verify-otp` + `OtpRateLimiterService` work with dev OTP `123456` in non-prod; `@supabase/supabase-js` is absent (real SMS/Email OTP delivery mocked) and rate limiter is in-memory (not Redis). |
| 10 | **User & Anonymous Identity** | `PARTIALLY IMPLEMENTED` | Community-scoped `Anonymous #XXXX` + audit-logged lookup work; however `users.service.ts:93-125` account deletion does not scrub/soft-delete posts/comments or revoke tokens, and `identities.service.ts:20` `count + 1` naming can race under concurrency. |
| 11 | **Location & Geospatial** | `PARTIALLY IMPLEMENTED` | 10-city catalog & `location_preferences` work; `resolve-cell` uses naive 0.05° grid (`location.service.ts:38-58`) instead of H3/PostGIS `ST_DWithin`, `checkLocationPrivacyThreshold` is unused, and mobile never calls `/location/cities` or `/location/preference`. |
| 12 | **Communities** | `IMPLEMENTED` | List, detail, join/leave, community feed, and admin status toggle work in DB and UI; `apps/admin` community creation (`POST /admin/communities`) is missing on backend. |
| 13 | **Posts, Comments & Reactions** | `PARTIALLY IMPLEMENTED` | Text posts, comments, nested replies, reactions, save/unsave, and poll vote backend exist; missing S3 `PostMedia` uploads, mobile Polls UI, mobile delete-own-post/comment UI, and `$transaction` around post+poll+idempotency writes. |
| 14 | **Feed & Discovery** | `PARTIALLY IMPLEMENTED` | Nearby, latest, trending, and category feeds work with block filtering; `getNearby` lacks PostGIS spatial query, `getTrending` sorts top 100 in JS without cursor, pagination cursor lacks `(createdAt, id)` tie-breaker, mobile ignores `next_cursor`, and post search is missing. |
| 15 | **Reporting & Blocking** | `PARTIALLY IMPLEMENTED` | Reports + duplicate guard + auto-priority + self-block guard work; **bug**: mobile `post/[id].tsx:80` checks `post?.author_user_id` which backend omits for anonymity, breaking author blocking on real API. |
| 16 | **Moderation & Appeals** | `PARTIALLY IMPLEMENTED` | Auto-moderation PII/keyword filter, queue, actions + `AuditLog`, and appeals endpoints exist on backend; missing mobile Appeals UI, ML/Hinglish moderation, appeal ownership validation (`submitAppeal`), and Admin contract alignment. |
| 17 | **Notifications & Realtime** | `PARTIALLY IMPLEMENTED` | In-app notifications, preferences, device token CRUD, and Socket.IO `/community` gateway exist; missing FCM/APNs push delivery, `@socket.io/redis-adapter`, mobile push registration, and live `comment:created`/`reaction:updated`/`notification:new` listeners. |
| 18 | **Testing Infrastructure** | `NEEDS TESTING` | 29 API unit/e2e tests + 11 Mobile tests pass, but **0 real PostgreSQL/PostGIS/Redis integration tests**, **0 Admin tests**, **0 Maestro mobile E2E**, and **0 k6 load tests** exist. |
| 19 | **GitHub Actions CI/CD** | `PARTIALLY IMPLEMENTED` | `ci.yml`, `pr-validation.yml`, and `deploy-staging.yml` exist; missing `format:check`, real Postgres migration/integration test execution (CI sets `DEV_IN_MEMORY=true`), `deploy-production.yml`, and actual registry/cluster deployment steps. |
| 20 | **Docker & Deployment** | `PARTIALLY IMPLEMENTED` | `docker-compose.dev.yml`, `docker-compose.test.yml`, and `Dockerfile.api` are valid; missing Terraform/AWS CDK IaC (VPC, RDS, ElastiCache, ECS/EKS, S3, CloudFront). |
| 21 | **Env Vars & Secrets** | `TECHNICAL DEBT` | `.env.example` and `.env.test` documented and `.env` gitignored; `JWT_SECRET` has `'dev-secret'` fallbacks in 3 places, `apps/admin` pre-fills demo password in `login/page.tsx:36-37`, and local `.env` files exist untracked. |
| 22 | **Logging & Error Handling** | `PARTIALLY IMPLEMENTED` | `GlobalExceptionFilter` emits `ErrorEnvelope` and mobile enforces leak-stop mapping; missing structured JSON request logging, correlation IDs across async jobs, and sanitization review. |
| 23 | **Monitoring & Observability** | `MISSING` | No Sentry error tracking, OpenTelemetry tracing, Prometheus metrics, or CloudWatch/Grafana alert rules configured. |

---

## 5. Exact Backend Endpoints & Prisma Baseline

- **Backend API (`apps/api/src/**/*.controller.ts`)**: 60+ endpoints across `AppController` (`GET /v1/health`), `AuthController` (6), `UsersController` (4), `IdentitiesController` (2), `LocationController` (3), `CommunitiesController` (5), `PostsController` (10), `CommentsController` (4), `FeedController` (4), `NotificationsController` (7), `ReportsController` (2), `BlocksController` (3), `ModerationController` (5), `AdminController` (12), and `AnalyticsController` (1), plus Socket.IO `/community` gateway.
- **Prisma Schema (`apps/api/prisma/schema.prisma`)**: 24 models (`User`, `AnonymousIdentity`, `Community`, `CommunityMember`, `Post`, `PostMedia`, `Comment`, `Reaction`, `SavedPost`, `Report`, `Block`, `Notification`, `DeviceToken`, `NotificationPreference`, `ModerationAction`, `ModerationAppeal`, `AuditLog`, `UserConsent`, `LocationPreference`, `IdempotencyKey`, `Poll`, `PollOption`, `PollVote`, `AdminRole`) and 15 enums.

---

## 6. Verified Bugs & Client–Backend Contract Mismatches

### Mobile (`apps/mobile/**`) vs Backend (`apps/api/**`)
1. **Age Verify 404**: `src/api/auth.api.ts:74` calls `POST /auth/age-verify`; backend is `POST /v1/auth/verify-age` (`auth.controller.ts:69`).
2. **Notification Read 404**: `src/api/notifications.api.ts:36` calls `POST /notifications/:id/read`; backend is `PATCH /v1/notifications/:id/read` (`notifications.controller.ts:61`).
3. **My Posts / Saved Posts 404**: `src/api/users.api.ts:24,36` calls `GET /users/me/posts` and `GET /users/me/saved`; backend is `GET /v1/posts/me/authored` and `GET /v1/posts/me/saved` (`posts.controller.ts:49,55`).
4. **Category Feed Filter Ignored**: `src/api/feed.api.ts:77-84` sends `?category=` to `/feed/latest|trending|nearby`; backend requires `GET /v1/feed/category/:category` (`feed.controller.ts:69`).
5. **Non-UUID Community Slugs**: `src/utils/location.ts:12-21` hardcodes `'city-bengaluru'` etc., failing `@IsUUID()` in `CreatePostDto` when communities haven't synced from API.
6. **Profile PostCard No-Op Handlers**: `app/(tabs)/profile.tsx:114-116,137-139` passes `() => undefined` for `onReact`, `onSave`, and `onReport`.
7. **No 401 Token Refresh**: `src/api/client.ts:21-27` lacks a response interceptor to call `POST /v1/auth/refresh` on 15m JWT expiry.
8. **Block Author Broken on Real API**: `app/post/[id].tsx:80` checks `post?.author_user_id`, which real `PostsService` intentionally omits for anonymity.
9. **Login Ignores `age_verified`**: `app/(auth)/login.tsx:76` always navigates to `age-eligibility` regardless of `tokens.age_verified`.
10. **Delete Post/Comment Unwired**: `postsApi.remove` (`posts.api.ts:80`) is unused in UI; `commentsApi` lacks `DELETE /v1/comments/:commentId`.

### Admin (`apps/admin/**`) vs Backend (`apps/api/**`)
1. **Unimplemented Admin Login**: `src/lib/api-client.ts:183-225` posts to `POST /admin/auth/login` (404), triggering demo fallback token `demo_admin_jwt_*`.
2. **Overview Shape Mismatch**: `api-client.ts:230-235` expects `{ dau }`, while `AdminService.getOverview()` returns `{ kpis: { ... }, priority_reports }`, forcing Demo Mode even when API is online.
3. **Action Route Mismatch**: `api-client.ts:261` calls `POST /admin/reports/:id/action`; backend is `POST /v1/admin/moderation/actions` (`admin.controller.ts:89`).
4. **Missing Status/Create Endpoints**: `PATCH /admin/posts/:id/status`, `PATCH /admin/comments/:id/status`, and `POST /admin/communities` (`api-client.ts:293,328,420`) do not exist in `AdminController`.
5. **Appeals Route/Payload Mismatch**: `api-client.ts:452-455` calls `POST /admin/appeals/:id/resolve` (`{ status, reviewer_note }`); backend is `PATCH /v1/admin/appeals/:id` (`{ status, resolution_notes }`).
6. **Casing & Role Drift**: `apps/api` returns `snake_case` (`target_type`, `anonymous_name`, `created_at`), while `apps/admin` reads `camelCase` (`targetType`, `anonymousDisplayCode`, `createdAt`); roles differ (`SENIOR_MODERATOR` in Admin vs `ANALYST` in API vs `MODERATION_LEAD`/`TRUST_SAFETY`/`COMMUNITY_MANAGER` in `shared-types`).

---

## 7. Security & Privacy Risks (Ranked)

| Severity | Finding | Exact Location |
|---|---|---|
| **Critical** | Hardcoded `'dev-secret'` JWT secret fallback if `JWT_SECRET` env var is omitted | `apps/api/src/auth/auth.service.ts:215,235`, `jwt.strategy.ts:16`, `community.gateway.ts:37` |
| **Critical** | Expired `AdminRole.expiresAt` is never checked in `RolesGuard` | `apps/api/src/common/guards/roles.guard.ts:18-38` |
| **High** | `AdminService.getReports()` exposes raw `reporter_id` (`userId`) in moderation payloads | `apps/api/src/admin/admin.service.ts:70` |
| **High** | No `ageVerified` guard on `POST /v1/posts` or `POST /v1/posts/:id/comments` | `apps/api/src/posts/posts.controller.ts:39`, `comments.controller.ts:48` |
| **High** | Account deletion leaves user's `Post`/`Comment` rows active and JWTs/AdminRoles unrevoked | `apps/api/src/users/users.service.ts:93-125` |
| **High** | No Next.js `middleware.ts` server-side auth guard; Admin UI exposes restricted controls to `MODERATOR` | `apps/admin/src/app/dashboard/layout.tsx:17-29`, `login/page.tsx:38,139-158` |
| **Medium** | JWTs stored in browser `localStorage` on Web/Admin (XSS exposure outside local dev) | `apps/mobile/src/utils/storage.ts:13-66`, `apps/admin/src/lib/api-client.ts:39,49-67` |
| **Medium** | Socket.IO gateway uses `cors: { origin: '*' }` and skips `Block` filtering on room broadcasts | `apps/api/src/realtime/community.gateway.ts:16` |
| **Medium** | `submitAppeal()` does not verify appellant owns the referenced `moderation_action_id` | `apps/api/src/moderation/moderation.controller.ts:86` |

---

## 8. Recommended Remediation Summary

1. **Immediate (Release 0.1)**: Fix all Critical/High security bugs (`JWT_SECRET` fail-fast in prod, `expiresAt` check in `RolesGuard`, strip `reporter_id`, enforce `ageVerified`), unify `AdminRoleType` + `openapi.yaml` + Mobile/Admin API client routes, fix `format:check` & Mobile ESLint config, and clean the 49 dirty `apps/mobile` files.
2. **Core Integrations (Release 0.2–0.3)**: Replace in-memory OTP/revocation with Redis, wire Supabase Auth SMS/Email, wrap post+poll+idempotency in Prisma `$transaction`, add real PostgreSQL/PostGIS integration tests + Admin tests, and implement missing P1 UIs (Polls, Search, Pagination, Appeals, Live Socket.IO listeners, Block-by-post/comment).
3. **Production Readiness (Release 0.9–1.0)**: Add S3 media uploads, FCM/APNs push, PostGIS `ST_DWithin` / H3 location privacy thresholds, Sentry + OpenTelemetry, Terraform/AWS IaC, `deploy-production.yml`, Maestro E2E, k6 load testing, and Trust & Safety / DPDP compliance runbooks.
