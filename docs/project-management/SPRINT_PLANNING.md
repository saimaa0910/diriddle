# diriddle — Solo-Developer Sprint Planning & Execution Guide

> **Cadence**: `6` × 2-week sprints (10 working days per sprint, Mon–Fri).  
> **Target Velocity**: `14–15` story points per sprint (`86` committed points across 12 weeks).  
> **First Sprint Start**: **Sprint 1** (`14` pts across `7` issues) targeting `Release 0.1 – Engineering Alpha`.

---

## 1. Solo-Developer Capacity Model

Unlike a multi-engineer team where story points measure pure feature coding, a solo founder/engineer absorbs every phase of the SDLC. Planning at raw theoretical capacity (25–30 pts/sprint) guarantees chronic spillover and skipped tests.

### Weekly Time Allocation (40 Hours / Week = 80 Hours / 2-Week Sprint)
| Activity Category | Share | Hours / Sprint | Scope in `diriddle` |
|---|---|---|---|
| **Feature & Fix Implementation** | 50% | 40 hrs | NestJS modules, Prisma migrations, Expo React Native/Web, Next.js Admin, Terraform/CI |
| **Testing & QA Verification** | 20% | 16 hrs | Unit specs, Supertest E2E, real Postgres/PostGIS integration tests, Windows Web smoke tests |
| **Debugging, Self-Review & Hygiene** | 12% | 10 hrs | Line-by-line `git diff` review, Prettier/ESLint/TypeScript fixes, Windows CRLF/Metro edge cases |
| **DevOps, Staging & Deployment** | 10% | 8 hrs | Docker Compose, GitHub Actions CI/CD, Prisma deploy, environment secret management |
| **Sprint Planning, Docs & PM Overhead** | 8% | 6 hrs | Issue grooming, `DRIFT-REGISTER.md` / `CHANGE-MATRIX.md` updates, Sprint Retro & Backlog triage |
| **Total Capacity** | **100%** | **80 hrs** | Maps to **14–15 story points** (~4.5–5.5 effective hours per story point) |

### Velocity Calibration & Tracking Formula
- **Sprint 1 Calibration Band**: `12–15` story points (`14` pts committed).
- **Rolling Velocity Formula** (applied starting Sprint 2):
  $$\text{Planned Capacity}_{n} = \min\left(16,\ \left\lfloor \frac{\sum_{i=\max(1, n-3)}^{n-1} \text{Completed Points}_i}{\min(3,\ n-1)} \right\rfloor\right)$$
- **Scope Protection Rule**: Only issues meeting [`DEFINITION_OF_READY.md`](./DEFINITION_OF_READY.md) enter a sprint. If an unplanned P0 production or security incident arises mid-sprint, an equal-point P1/P2 item is immediately moved back to the Product Backlog—never silently added on top of the 15-pt cap.

---

## 2. Standard 2-Week Sprint Cadence (Day 1 – Day 10)

| Sprint Day | Phase | Concrete Solo-Developer Actions |
|---|---|---|
| **Day 1 (Mon W1)** | **Sprint Planning & Setup** | Pull committed `DIR-XXX` tickets into **In Progress** on GitHub Project; verify local Docker Postgres/PostGIS & Redis (`docker compose -f infrastructure/docker/docker-compose.dev.yml up -d`); cut first `feature/DIR-XXX-*` or `bugfix/DIR-XXX-*` branch from `develop`. |
| **Days 2–5 (Tue–Fri W1)** | **Core Implementation Wave 1** | Implement highest-priority security/foundation blockers first; keep PRs small (1 issue = 1 branch = 1 PR); run `pnpm run typecheck` and targeted tests before every commit. |
| **Day 6 (Mon W2)** | **Tests, PR & CI Gate** | Complete unit + Supertest/Postgres integration tests for Wave 1; open PRs against `develop` using `.github/PULL_REQUEST_TEMPLATE.md`; confirm CI green. |
| **Day 7 (Tue W2)** | **Self-Review & Fixes** | Perform line-by-line `git diff` review against [`DEFINITION_OF_DONE.md`](./DEFINITION_OF_DONE.md) (especially PII/anonymity non-leakage and `CODEOWNERS` paths); merge Wave 1 PRs; begin final sprint tickets. |
| **Days 8–9 (Wed–Thu W2)** | **QA & Full-Stack Integration** | Run full workspace checks (`format:check`, `lint`, `typecheck`, `build`, `test`, `test:e2e`, `test:pg`); run Windows smoke test (`pnpm run test:windows`) across API (`:3000`), Expo Web (`:8081`), and Admin (`:3001`). |
| **Day 10 (Fri W2)** | **Sprint Review, Retro & Release Cut** | Demo completed stories against acceptance criteria; update `DRIFT-REGISTER.md` & `CHANGE-MATRIX.md`; tag milestone release when at a Milestone Gate; log completed story points and calibrate next sprint's capacity. |

---

## 3. Sprint 1 Execution Plan (Exact Starting Order & Commands)

**Sprint 1 Goal**: Lock down JWT/RBAC security invariants, resolve Windows CRLF & Prettier drift across the repo, unify `AdminRoleType`, and fix immediate mobile P0 API route bugs.  
**Total Committed**: **14 points** (`7` issues) | **Target Milestone**: `Release 0.1 – Engineering Alpha`.

### Exact First 5 Tasks to Start Sprint 1 (Sequential Critical Path)

#### 1. `DIR-041` (2 pts, `P0`) — Remove hardcoded `dev-secret` JWT fallbacks & fail closed
- **Branch**: `bugfix/DIR-041-fail-closed-jwt-secrets`
- **Target Files**: `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/jwt.strategy.ts`, `apps/api/src/realtime/community.gateway.ts`, `apps/api/src/main.ts`
- **Action**: Require `JWT_SECRET` and `JWT_REFRESH_SECRET` at startup (fail fast in production if missing or `< 32` chars; generate ephemeral random test secret only in explicit `DEV_IN_MEMORY=true` / `NODE_ENV=test`), and delete all `'dev-secret'` literals.
- **Verify**:
  ```powershell
  pnpm --filter @diriddle/api type-check; pnpm --filter @diriddle/api test
  ```

#### 2. `DIR-038` (3 pts, `P0`) — Enforce `AdminRole.expiresAt` in `RolesGuard`
- **Branch**: `bugfix/DIR-038-enforce-admin-role-expiry`
- **Target Files**: `apps/api/src/common/guards/roles.guard.ts`, `apps/api/src/common/guards/roles.guard.spec.ts` (new)
- **Action**: Check `adminRole.expiresAt && adminRole.expiresAt <= new Date()` and throw `ForbiddenException` with `error: 'ADMIN_ROLE_EXPIRED'`. Add unit + E2E coverage for active vs expired admin grants.
- **Verify**:
  ```powershell
  pnpm --filter @diriddle/api test; pnpm --filter @diriddle/api test:e2e
  ```

#### 3. `DIR-003` (1 pt, `P2`) — Resolve 49 CRLF/newline dirty files in `apps/mobile` & enforce `.gitattributes` LF
- **Branch**: `chore/DIR-003-gitattributes-lf-cleanup`
- **Target Files**: `.gitattributes` (new), `apps/mobile/tsconfig.json`, dirty files in `apps/mobile/**`
- **Action**: Add `.gitattributes` (`* text=auto eol=lf`, `*.ps1 text eol=crlf`, `*.bat text eol=crlf`), commit intentional `apps/mobile/tsconfig.json` updates, and renormalize line endings (`git add --renormalize .`) so `git status` is clean before formatting.
- **Verify**:
  ```powershell
  git status --short; pnpm --filter @diriddle/mobile test
  ```

#### 4. `DIR-001` (2 pts, `P1`) — Fix Prettier formatting across 126 files & enforce `format:check` in CI
- **Branch**: `chore/DIR-001-prettier-format-and-ci-gate`
- **Target Files**: Root/workspace formatted files + `.github/workflows/ci.yml` (and `.github/workflows/pr-validation.yml`)
- **Action**: Depends on `DIR-003` completing first so CRLF churn doesn't pollute the formatting diff. Run `pnpm run format` and add `pnpm run format:check` to CI.
- **Verify**:
  ```powershell
  pnpm run format:check; pnpm run typecheck; pnpm run build
  ```

#### 5. `DIR-004` (2 pts, `P1`) — Align `AdminRoleType` enum across `@diriddle/shared-types`, `apps/api`, and `apps/admin`
- **Branch**: `feature/DIR-004-align-admin-role-type`
- **Target Files**: `packages/shared-types/src/index.ts`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/*`, `apps/api/src/admin/admin.controller.ts`, `apps/admin/src/lib/types.ts`
- **Action**: Standardize canonical `AdminRoleType` (`SUPER_ADMIN`, `TRUST_SAFETY_LEAD`, `MODERATOR`, `ANALYST`) in `@diriddle/shared-types`, rebuild `@diriddle/shared-types`, align Prisma/controllers, and remove the duplicate local `AdminRole` type in `apps/admin`.
- **Verify**:
  ```powershell
  pnpm --filter @diriddle/shared-types build; pnpm run typecheck; pnpm --filter @diriddle/admin build
  ```

### Remaining Sprint 1 Tasks (Days 7–9, after first 5 tasks)
6. **`DIR-007` (2 pts, `P0`)** — `bugfix/DIR-007-mobile-verify-age-routing`: Update `apps/mobile/src/api/auth.api.ts` (`/auth/age-verify` -> `/auth/verify-age`) and `app/(auth)/login.tsx` conditional `age_verified` routing.
7. **`DIR-030` (2 pts, `P0`)** — `bugfix/DIR-030-notification-patch-method`: Update `apps/mobile/src/api/notifications.api.ts` `markRead` from `POST` to `PATCH`.

### Sprint 1 Exit Criteria
- All 7 issues (`14` pts) pass [`DEFINITION_OF_DONE.md`](./DEFINITION_OF_DONE.md) and are merged to `develop`.
- `pnpm run format:check`, `pnpm run typecheck`, `pnpm run build`, `pnpm --filter @diriddle/api test`, `pnpm --filter @diriddle/api test:e2e`, and `pnpm --filter @diriddle/mobile test` all exit `0`.
- `git status` is clean on Windows PowerShell.

---

## 4. Sprint-by-Sprint Execution Plan (Sprints 2–6)

### Sprint 2 (Weeks 3–4, 14 pts) — `Release 0.1 – Engineering Alpha` Gate
- **Issues & Branches**:
  1. `DIR-002` (3 pts) — `chore/DIR-002-real-eslint-configs` (Days 1–3)
  2. `DIR-012` (3 pts) — `bugfix/DIR-012-age-verified-guard` (Days 3–5; requires `DIR-007`)
  3. `DIR-013` (3 pts) — `bugfix/DIR-013-identity-collision-retry` (Days 5–6)
  4. `DIR-044` (5 pts) — `feature/DIR-044-postgres-postgis-integration-tests` (Days 6–9)
- **Sprint 2 Exit**: Tag `v0.1.0-alpha.1` once `pnpm run lint` (`0` warnings) and `pnpm --filter @diriddle/api test:pg` pass against Docker PostgreSQL + PostGIS + Redis.

### Sprint 3 (Weeks 5–6, 14 pts) — Auth Hardening & Real Postgres CI
- **Issues & Branches**:
  1. `DIR-008` (5 pts) — `feature/DIR-008-supabase-otp-and-dev-gate` (Days 1–4; requires `DIR-041`)
  2. `DIR-009` (3 pts) — `feature/DIR-009-redis-otp-and-jti-revocation` (Days 4–6; requires `DIR-041`)
  3. `DIR-010` (3 pts) — `bugfix/DIR-010-mobile-401-refresh-interceptor` (Days 6–8)
  4. `DIR-049` (3 pts) — `chore/DIR-049-ci-postgres-and-format-check` (Days 8–9; requires `DIR-001`, `DIR-044`)
- **Sprint 3 Exit**: GitHub Actions CI executes `format:check` and real Postgres/Redis integration tests on PRs; OTP dev bypass `123456` fails closed when `ALLOW_DEV_OTP` is unset.

### Sprint 4 (Weeks 7–8, 15 pts) — `Release 0.2 – Feature Alpha` Gate
- **Issues & Branches**:
  1. `DIR-015` (5 pts) — `feature/DIR-015-postgis-h3-geo-cells` (Days 1–4; requires `DIR-044`)
  2. `DIR-016` (3 pts) — `feature/DIR-016-k-anonymity-threshold` (Days 4–6; requires `DIR-015`)
  3. `DIR-021` (3 pts) — `feature/DIR-021-atomic-post-poll-transaction` (Days 6–7; requires `DIR-013`)
  4. `DIR-027` (2 pts) — `bugfix/DIR-027-mobile-category-feed-route` (Day 8)
  5. `DIR-034` (2 pts) — `bugfix/DIR-034-appeal-ownership-check` (Day 9)
- **Sprint 4 Exit**: Tag `v0.2.0-alpha.1`; verify `ST_DWithin` + `h3-js` resolution 7 queries and `< 20` active users k-anonymity fallback against real PostGIS.

### Sprint 5 (Weeks 9–10, 14 pts) — `Release 0.3 – Safety Beta` Gate
- **Issues & Branches**:
  1. `DIR-011` (3 pts) — `feature/DIR-011-dpdp-account-deletion-scrubbing` (Days 1–3; requires `DIR-009`)
  2. `DIR-033` (3 pts) — `bugfix/DIR-033-anonymous-safe-author-blocking` (Days 3–5)
  3. `DIR-036` (5 pts) — `bugfix/DIR-036-admin-live-api-wiring` (Days 5–8; requires `DIR-004`)
  4. `DIR-037` (3 pts) — `bugfix/DIR-037-strip-reporter-id-and-role-ui` (Days 8–9; requires `DIR-036`)
- **Sprint 5 Exit**: Tag `v0.3.0-beta.1`; verify full Safety & Moderation loop live on API + Mobile Web + Admin Console with zero `user_id` or `reporter_id` exposure.

### Sprint 6 (Weeks 11–12, 15 pts) — `Release 0.9 RC` & `Release 1.0 MVP` Launch
- **Issues & Branches**:
  1. `DIR-051` (5 pts) — `feature/DIR-051-terraform-aws-ap-south-1` (Days 1–4; requires `DIR-049`)
  2. `DIR-052` (3 pts) — `feature/DIR-052-deploy-production-workflow` (Days 4–5; requires `DIR-049`, `DIR-051`)
  3. `DIR-053` (2 pts) — `chore/DIR-053-prelaunch-security-checklist` (Day 6; tag `v0.9.0-rc.1`)
  4. `DIR-054` (2 pts) — `chore/DIR-054-rds-backups-and-pitr-dr-drill` (Days 7–8; requires `DIR-051`, `DIR-052`)
  5. `DIR-055` (2 pts) — `feature/DIR-055-eas-builds-and-staging-soak` (Days 7–9; requires `DIR-044`, `DIR-052`)
  6. `DIR-056` (1 pt) — `chore/DIR-056-incident-runbooks-and-go-no-go` (Day 10; tag `v1.0.0`)
- **Sprint 6 Exit**: Production `v1.0.0` deployed to `ap-south-1` via gated CD; DR restore drill, 48h staging soak, and Go/No-Go sign-off archived.
