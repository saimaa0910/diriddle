# diriddle — Epics & User Stories (`DIR-EP01` – `DIR-EP15`)

> **Scope**: Canonical 15 Epics mapped from the Phase 1 Repository Audit (`#42`, `#43`, `#44`, `#45`, `#47`) and Requirements Traceability Matrix (`REQUIREMENTS_TRACEABILITY_MATRIX.md`).  
> **Delivery Model**: Solo developer executing 6 × 2-week sprints (12 weeks, 14–15 pts/sprint, 86 committed MVP points across 30 issues + 102 backlog points across 28 issues).

---

## Epic Summary Index

| Epic ID | Epic Name | Child Issues | Target Milestone(s) | Committed Pts | Backlog Pts |
|---|---|---|---|---|---|
| `DIR-EP01` | Project Foundation & Architecture | `DIR-001`..`DIR-006` | `Release 0.1 – Engineering Alpha`, `Backlog` (`DIR-005`, `DIR-006`) | 8 | 8 |
| `DIR-EP02` | Authentication & Account Management | `DIR-007`..`DIR-011` | `Release 0.1 – Engineering Alpha`, `Release 0.2 – Feature Alpha`, `Release 0.3 – Safety Beta` | 16 | 0 |
| `DIR-EP03` | Anonymous Identity & Privacy | `DIR-012`..`DIR-014` | `Release 0.1 – Engineering Alpha`, `Backlog` (`DIR-014`) | 6 | 2 |
| `DIR-EP04` | Location & Geospatial Services | `DIR-015`..`DIR-017` | `Release 0.2 – Feature Alpha`, `Backlog` (`DIR-017`) | 8 | 3 |
| `DIR-EP05` | Communities | `DIR-018`..`DIR-019` | `Backlog` (`DIR-018`, `DIR-019`) | 0 | 5 |
| `DIR-EP06` | Posts & Content Management | `DIR-020`..`DIR-024` | `Release 0.2 – Feature Alpha` (`DIR-021`), `Backlog` (`DIR-020`, `DIR-022`..`DIR-024`) | 3 | 14 |
| `DIR-EP07` | Comments & Reactions | `DIR-025`..`DIR-026` | `Backlog` (`DIR-025`, `DIR-026`) | 0 | 8 |
| `DIR-EP08` | Nearby Feed & Discovery | `DIR-027`..`DIR-029` | `Release 0.2 – Feature Alpha` (`DIR-027`), `Backlog` (`DIR-028`, `DIR-029`) | 2 | 5 |
| `DIR-EP09` | Notifications | `DIR-030`..`DIR-032` | `Release 0.1 – Engineering Alpha` (`DIR-030`), `Backlog` (`DIR-031`, `DIR-032`) | 2 | 7 |
| `DIR-EP10` | Safety, Reporting & Blocking | `DIR-033`..`DIR-035` | `Release 0.2 – Feature Alpha` (`DIR-034`), `Release 0.3 – Safety Beta` (`DIR-033`), `Backlog` (`DIR-035`) | 5 | 5 |
| `DIR-EP11` | Moderation & Admin Dashboard | `DIR-036`..`DIR-040` | `Release 0.1 – Engineering Alpha` (`DIR-038`), `Release 0.3 – Safety Beta` (`DIR-036`, `DIR-037`), `Backlog` (`DIR-039`, `DIR-040`) | 11 | 10 |
| `DIR-EP12` | Security & Privacy Compliance | `DIR-041`..`DIR-043` | `Release 0.1 – Engineering Alpha` (`DIR-041`), `Backlog` (`DIR-042`, `DIR-043`) | 2 | 8 |
| `DIR-EP13` | Testing & Quality Assurance | `DIR-044`..`DIR-048` | `Release 0.1 – Engineering Alpha` (`DIR-044`), `Backlog` (`DIR-045`..`DIR-048`) | 5 | 14 |
| `DIR-EP14` | CI/CD & Infrastructure | `DIR-049`..`DIR-052` | `Release 0.2 – Feature Alpha` (`DIR-049`), `Release 0.9 – Release Candidate` (`DIR-051`, `DIR-052`), `Backlog` (`DIR-050`) | 11 | 3 |
| `DIR-EP15` | Production Release & Operations | `DIR-053`..`DIR-058` | `Release 0.9 – Release Candidate` (`DIR-053`), `Release 1.0 – MVP` (`DIR-054`..`DIR-056`), `Backlog` (`DIR-057`, `DIR-058`) | 7 | 10 |

---

## `DIR-EP01` — Project Foundation & Architecture
- **Business Goal**: Establish clean monorepo formatting, real static analysis/linting, clean Git line-ending hygiene, and unified shared contracts (`@diriddle/shared-types` and `openapi.yaml`) so all apps build against a single source of truth.
- **Scope**: Prettier formatting (`126` failing files), ESLint config for `apps/mobile` & `apps/api`, `.gitattributes` CRLF cleanup (`49` dirty files), `AdminRoleType` enum alignment, `openapi.yaml` reconciliation, and Expo SDK 53 / React 18 version-skew cleanup.
- **Baseline vs Remaining Gap**: Turborepo build (`5/5`) and `typecheck` (`6/6`) pass, but `format:check` fails on 126 files, mobile lint falls back to `|| echo lint-ok`, `openapi.yaml` misses ~20 implemented endpoints, and `AdminRoleType` differs across 3 packages.
- **Child Issues**: `DIR-001`, `DIR-002`, `DIR-003`, `DIR-004`, `DIR-005`, `DIR-006`
- **Target Milestones**: `Release 0.1 – Engineering Alpha` (`DIR-001`..`DIR-004`), Backlog (`DIR-005`, `DIR-006`)
- **Epic Acceptance Criteria**:
  - `pnpm run format:check`, `pnpm run lint`, and `pnpm run typecheck` all exit `0` with zero silent fallbacks.
  - `openapi.yaml` validates and matches every active `/v1/*` controller route.

## `DIR-EP02` — Authentication & Account Management
- **Business Goal**: Deliver production-grade, rate-limited passwordless OTP authentication, reliable session refresh, and DPDP-compliant account deletion.
- **Scope**: Mobile `/v1/auth/verify-age` fix, Supabase Auth OTP integration, Redis-backed OTP rate limiting & refresh token revocation, mobile 401 token refresh interceptor, and full DPDP account deletion scrubbing.
- **Baseline vs Remaining Gap**: JWT issuance/rotation and age consent DB writes work in-memory, but OTP is not sent via Supabase, `revokedJtis`/`OtpRateLimiterService` live in process memory, dev OTP `123456` works in all non-prod modes, mobile calls `/auth/age-verify` (404), and `DELETE /v1/users/me` leaves authored posts/comments intact.
- **Child Issues**: `DIR-007`, `DIR-008`, `DIR-009`, `DIR-010`, `DIR-011`
- **Target Milestones**: `Release 0.1 – Engineering Alpha`, `Release 0.2 – Feature Alpha`, `Release 0.3 – Safety Beta`
- **Epic Acceptance Criteria**:
  - OTPs are delivered via Supabase Auth and rate-limited in Redis; `123456` is disabled outside explicit test flags.
  - Mobile handles 15m token expiry transparently via `/v1/auth/refresh`.
  - Account deletion scrubs PII, authored posts/comments, and active sessions.

## `DIR-EP03` — Anonymous Identity & Privacy
- **Business Goal**: Guarantee community-scoped anonymous personas (`Anonymous #XXXX`) with zero `user_id` leakage across public APIs and UI clients.
- **Scope**: Server-side 18+ `ageVerified` guard on write endpoints, concurrency-safe `Anonymous #XXXX` generation, and wiring `users/me/identities` while removing `author_user_id` expectations in mobile.
- **Baseline vs Remaining Gap**: `IdentitiesService` scopes identities per `(userId, communityId)` and logs compliance lookups, but `count + 1` naming can collide concurrently, write endpoints do not enforce `ageVerified`, and mobile checks `post.author_user_id` (absent in API).
- **Child Issues**: `DIR-012`, `DIR-013`, `DIR-014`
- **Target Milestones**: `Release 0.1 – Engineering Alpha` (`DIR-012`, `DIR-013`), Backlog (`DIR-014`)
- **Epic Acceptance Criteria**:
  - Unverified (`ageVerified: false`) users receive `403 AGE_VERIFICATION_REQUIRED` when posting/commenting/reacting.
  - Concurrent identity creation in any community never produces duplicate `displayCode` values.

## `DIR-EP04` — Location & Geospatial Services
- **Business Goal**: Enable hyperlocal Indian city and coarse neighborhood discovery without storing raw GPS coordinates or violating k-anonymity privacy thresholds.
- **Scope**: PostGIS spatial columns & `ST_DWithin` / `h3-js` geo-cell resolution, k-anonymity privacy threshold enforcement (`>= 20` active users), and mobile location-setup API integration.
- **Baseline vs Remaining Gap**: Static 10-city catalog and 0.05° grid stub exist; `checkLocationPrivacyThreshold` is unused; mobile does not call `GET /v1/location/cities` or `PUT /v1/location/preference`.
- **Child Issues**: `DIR-015`, `DIR-016`, `DIR-017`
- **Target Milestones**: `Release 0.2 – Feature Alpha` (`DIR-015`, `DIR-016`), Backlog (`DIR-017`)
- **Epic Acceptance Criteria**:
  - Approximate lat/lng resolves via `h3-js` / PostGIS without persisting exact coordinates.
  - Sparse geo-cells (`< 20` active users) automatically fall back to city-level scope.

## `DIR-EP05` — Communities
- **Business Goal**: Support seamless discovery, membership, and administration of India city, neighborhood, and campus communities.
- **Scope**: Replace mobile hardcoded `city-*` fallback IDs with real community UUIDs, and add admin community creation (`POST /v1/admin/communities`).
- **Baseline vs Remaining Gap**: Community listing, join/leave, and feeds work on backend; mobile `create.tsx` falls back to non-UUID `'city-bengaluru'`; admin dashboard `createCommunity` calls a missing `POST /v1/admin/communities` endpoint.
- **Child Issues**: `DIR-018`, `DIR-019`
- **Target Milestones**: Backlog (`DIR-018`, `DIR-019`)
- **Epic Acceptance Criteria**:
  - Mobile post creation always resolves a valid community UUID from `/v1/communities`.

## `DIR-EP06` — Posts & Content Management
- **Business Goal**: Deliver rich, atomic, idempotent anonymous posting including text posts, polls, media attachments, bookmarks, and self-deletion.
- **Scope**: Mobile `me/authored` & `me/saved` endpoint fixes + profile PostCard handlers, `$transaction` atomicity for post creation, S3 presigned media upload (`PostMedia`), Polls creation/voting UI, and delete-post UI.
- **Baseline vs Remaining Gap**: Core text posts, idempotency keys, save/unsave, and backend poll voting work; `PostMedia` has no upload endpoint/UI; mobile has no Poll UI, no delete UI, and wrong `/users/me/posts|saved` paths.
- **Child Issues**: `DIR-020`, `DIR-021`, `DIR-022`, `DIR-023`, `DIR-024`
- **Target Milestones**: `Release 0.2 – Feature Alpha` (`DIR-021`), Backlog (`DIR-020`, `DIR-022`..`DIR-024`)
- **Epic Acceptance Criteria**:
  - Users can create text, image, and poll posts, vote in polls, bookmark/react from Profile, and delete own posts/comments.

## `DIR-EP07` — Comments & Reactions
- **Business Goal**: Provide responsive, block-safe threaded discussions and real-time community updates at multi-instance scale.
- **Scope**: Block-filtered Socket.IO broadcasts + CORS hardening, `@socket.io/redis-adapter`, and live `comment:created` / `reaction:updated` listeners in mobile post detail.
- **Baseline vs Remaining Gap**: Threaded comments, 6 reactions, and `CommunityGateway` exist, but gateway uses `cors: '*'`, broadcasts to blocked users in rooms, lacks Redis adapter, and mobile `post/[id].tsx` doesn't subscribe to live comment/reaction events.
- **Child Issues**: `DIR-025`, `DIR-026`
- **Target Milestones**: Backlog (`DIR-025`, `DIR-026`)
- **Epic Acceptance Criteria**:
  - Blocked users never receive or see real-time room broadcasts from blocking/blocked peers; WS CORS honors `CORS_ORIGINS`.

## `DIR-EP08` — Nearby Feed & Discovery
- **Business Goal**: Power reliable, chronologically deterministic nearby, latest, trending, category, and search feeds with infinite scroll.
- **Scope**: Mobile category route fix (`GET /v1/feed/category/:category`), cursor tie-breaker `(createdAt, id)` + trending cursor, infinite scroll in mobile Home Feed, and server-side search endpoint (`GET /v1/feed/search`).
- **Baseline vs Remaining Gap**: `FeedService` filters blocks and returns 20 items, but mobile passes `?category=` to `/feed/latest`, cursor drops same-ms ties, `getTrending` lacks pagination, and `explore.tsx` searches communities only in memory.
- **Child Issues**: `DIR-027`, `DIR-028`, `DIR-029`
- **Target Milestones**: `Release 0.2 – Feature Alpha` (`DIR-027`), Backlog (`DIR-028`, `DIR-029`)
- **Epic Acceptance Criteria**:
  - Category chips, infinite scroll, and post/community search work end-to-end against PostgreSQL without skipped rows.

## `DIR-EP09` — Notifications
- **Business Goal**: Keep users engaged safely via accurate in-app notifications and native push alerts without exposing identities.
- **Scope**: Mobile `PATCH /v1/notifications/:id/read` fix, FCM/APNs push delivery + `expo-notifications` device registration, and real-time `notification:new` Activity updates.
- **Baseline vs Remaining Gap**: In-app notifications and Socket.IO emits work on backend, but mobile calls `POST` instead of `PATCH`, `expo-notifications` is unused, and FCM/APNs delivery is unimplemented.
- **Child Issues**: `DIR-030`, `DIR-031`, `DIR-032`
- **Target Milestones**: `Release 0.1 – Engineering Alpha` (`DIR-030`), Backlog (`DIR-031`, `DIR-032`)
- **Epic Acceptance Criteria**:
  - Marking notifications read updates backend state cleanly across both web and mobile.

## `DIR-EP10` — Safety, Reporting & Blocking
- **Business Goal**: Protect users from harassment and doxxing through anonymous-safe blocking, prioritized reporting, and fair moderation appeals.
- **Scope**: Anonymous-safe author blocking from post/comment context, appeal subject ownership validation, and mobile Moderation Appeals UI.
- **Baseline vs Remaining Gap**: `ReportsService` and `BlocksService` enforce priority & self-block checks, but mobile `handleBlockAuthor` fails without `author_user_id`, `submitAppeal` lacks ownership verification, and mobile has no Appeals UI.
- **Child Issues**: `DIR-033`, `DIR-034`, `DIR-035`
- **Target Milestones**: `Release 0.2 – Feature Alpha` (`DIR-034`), `Release 0.3 – Safety Beta` (`DIR-033`), Backlog (`DIR-035`)
- **Epic Acceptance Criteria**:
  - Users can block any post/comment author without ever receiving their `user_id`, and only sanctioned authors can appeal actions via the Safety Center.

## `DIR-EP11` — Moderation & Admin Dashboard
- **Business Goal**: Connect the Next.js Moderation Console cleanly to real `/v1/admin/*` APIs with strict RBAC, PII isolation, and Indian-context abuse detection.
- **Scope**: Fix `apps/admin` `api-client.ts` contracts & OTP auth, strip `reporter_id` from moderator views, enforce `AdminRole.expiresAt` in `RolesGuard`, upgrade auto-moderation for Hinglish/obfuscated PII, and add Next.js server `middleware.ts` + HttpOnly cookie proxy.
- **Baseline vs Remaining Gap**: All 9 Admin dashboard pages exist in Demo Mode, but contract mismatches force fallback to `demoStore`; `RolesGuard` ignores `expiresAt`; `getReports` returns `reporter_id`; moderation filter covers basic English/numeric regexes only.
- **Child Issues**: `DIR-036`, `DIR-037`, `DIR-038`, `DIR-039`, `DIR-040`
- **Target Milestones**: `Release 0.1 – Engineering Alpha` (`DIR-038`), `Release 0.3 – Safety Beta` (`DIR-036`, `DIR-037`), Backlog (`DIR-039`, `DIR-040`)
- **Epic Acceptance Criteria**:
  - Admin dashboard operates live against `apps/api` with zero demo fallback on valid requests, role-gated UI/API enforcement, and zero PII/reporter exposure.

## `DIR-EP12` — Security & Privacy Compliance
- **Business Goal**: Eliminate hardcoded secret fallbacks, harden API abuse/rate-limit defenses, and formalize Indian DPDP Act & Trust & Safety legal SOPs.
- **Scope**: Fail-closed `JWT_SECRET` validation, per-route `@Throttle` limits & CORS hardening, and DPDP privacy/terms/escalation/law-enforcement SOP documentation (`docs/legal/`).
- **Baseline vs Remaining Gap**: Three files fall back to `'dev-secret'`; only global 100 req/min throttling exists; no `docs/legal/` compliance or escalation runbooks exist.
- **Child Issues**: `DIR-041`, `DIR-042`, `DIR-043`
- **Target Milestones**: `Release 0.1 – Engineering Alpha` (`DIR-041`), Backlog (`DIR-042`, `DIR-043`)
- **Epic Acceptance Criteria**:
  - Application refuses to boot in non-test mode without strong `JWT_SECRET`s; strict per-endpoint throttles and DPDP SOPs are verified.

## `DIR-EP13` — Testing & Quality Assurance
- **Business Goal**: Replace in-memory-only test confidence with real PostgreSQL/PostGIS/Redis integration tests, Admin tests, Mobile screen tests, Maestro E2E, and k6 performance validation.
- **Scope**: Real Postgres/PostGIS/Redis integration test suite (`jest.pg.config.js`), Admin unit & Playwright E2E suite, Mobile screen integration tests, Maestro E2E flows, and k6 load tests.
- **Baseline vs Remaining Gap**: 22 API unit tests, 7 in-memory E2E tests, and 11 mobile unit tests pass; 0 real Postgres tests, 0 Admin tests, 0 Maestro flows, and 0 k6 load scripts exist.
- **Child Issues**: `DIR-044`, `DIR-045`, `DIR-046`, `DIR-047`, `DIR-048`
- **Target Milestones**: `Release 0.1 – Engineering Alpha` (`DIR-044`), Backlog (`DIR-045`..`DIR-048`)
- **Epic Acceptance Criteria**:
  - Real PostgreSQL + PostGIS migrations, seed, and E2E tests pass; Admin and Mobile suites achieve critical flow coverage; k6 verifies feed P95 < 300ms.

## `DIR-EP14` — CI/CD & Infrastructure
- **Business Goal**: Automate real-DB quality gates in GitHub Actions, instrument full-stack observability, and codify reproducible AWS `ap-south-1` infrastructure and production CD.
- **Scope**: Real Postgres & `format:check` in `ci.yml`, structured logging + Sentry + OpenTelemetry, Terraform/CDK AWS IaC (`ap-south-1`), and `deploy-production.yml`.
- **Baseline vs Remaining Gap**: `ci.yml` sets `DEV_IN_MEMORY=true` and skips `format:check`; no Terraform/CDK, no `deploy-production.yml`, and no Sentry/OTel instrumentation exist.
- **Child Issues**: `DIR-049`, `DIR-050`, `DIR-051`, `DIR-052`
- **Target Milestones**: `Release 0.2 – Feature Alpha` (`DIR-049`), `Release 0.9 – Release Candidate` (`DIR-051`, `DIR-052`), Backlog (`DIR-050`)
- **Epic Acceptance Criteria**:
  - Every PR validates formatting, linting, typecheck, and real Postgres migrations/tests; staging/prod infrastructure deploys reproducibly via IaC and gated CD.

## `DIR-EP15` — Production Release & Operations
- **Business Goal**: Ensure safe, auditable production launch in India with verified security posture, disaster recovery, app store builds, and incident runbooks.
- **Scope**: Pre-launch OWASP/anonymity security checklist, RDS PITR backup & restore drill, EAS Android/iOS build & soak test, incident response runbooks & Go/No-Go sign-off, plus post-MVP accessibility & volunteer moderator backlog.
- **Baseline vs Remaining Gap**: Local Windows launcher and staging workflow skeleton exist; no pen-test checklist, DR drill, EAS production profiles, or incident runbooks exist.
- **Child Issues**: `DIR-053`, `DIR-054`, `DIR-055`, `DIR-056`, `DIR-057`, `DIR-058`
- **Target Milestones**: `Release 0.9 – Release Candidate` (`DIR-053`), `Release 1.0 – MVP` (`DIR-054`..`DIR-056`), Backlog (`DIR-057`, `DIR-058`)
- **Epic Acceptance Criteria**:
  - Security sign-off, DR restore verification, store release artifacts, and monitoring alerts are verified prior to `Release 1.0 – MVP` launch.
