# Definition of Done (DoD) — diriddle

Every `DIR-XXX` ticket, bug fix, or release increment in `diriddle` is **Done** only when all applicable quality, testing, security, privacy, documentation, and deployment criteria below are verified.

> **Reference**: Complements the baseline summary in [`docs/definition-of-done.md`](../definition-of-done.md) with full Phase 8 enterprise verification gates.

---

## 1. Requirements & Acceptance Criteria
- [ ] Every `Given / When / Then` acceptance criterion in the `DIR-XXX` issue is implemented and verified.
- [ ] Scope is clean: no unrelated refactors, commented-out blocks, or leftover debug code.
- [ ] `DRIFT-REGISTER.md` updated if any intentional gap or deferral remains.

## 2. Code Quality & Static Gates
- [ ] `pnpm run lint` passes with zero errors (`apps/api`, `apps/mobile`, `apps/admin`, `packages/*`).
- [ ] `pnpm run format:check` passes cleanly (or updated files formatted with `pnpm run format`).
- [ ] `pnpm run typecheck` (`tsc --noEmit`) passes across all workspaces with zero errors.
- [ ] `pnpm run build` succeeds for `@diriddle/shared-types`, `@diriddle/api` (`dist/main.js`), `@diriddle/admin` (`.next`), and `@diriddle/mobile` (`expo export --platform web`).
- [ ] Code adheres to [`docs/code-review-guidelines.md`](../code-review-guidelines.md).

## 3. Testing Gates
- [ ] **Unit Tests**: `pnpm run test` passes (`apps/api` Jest specs, `apps/mobile` Jest/RNTL specs, `apps/admin` tests where applicable) with no skipped or relaxed assertions.
- [ ] **Real PostgreSQL Integration Tests**: Database/Prisma/PostGIS/constraint changes verified against a real PostgreSQL + PostGIS instance (not only `DEV_IN_MEMORY=true`).
- [ ] **API / E2E Tests**: `pnpm run test:e2e` (Supertest) passes for affected endpoints and error envelopes.
- [ ] **Mobile / Admin Verification**: UI changes verified on Windows Expo Web (`http://localhost:8081`) / Next.js Admin (`http://localhost:3001`) with zero uncaught console/runtime errors.

## 4. Code Review (Solo-Developer Self-Review Checklist)
Before merging any PR into `develop` or `main`:
- [ ] Self-review the complete `git diff` line by line after running final tests.
- [ ] Confirm `CODEOWNERS` sensitivity areas (`auth/`, `identities/`, `location/`, `moderation/`, `prisma/`, `.github/`) receive extra verification.
- [ ] Confirm PR uses `.github/PULL_REQUEST_TEMPLATE.md` and CI workflow `.github/workflows/pr-validation.yml` is green.

## 5. Security & Privacy Invariants (Non-Negotiable)
- [ ] **`users.id` / PII Non-Leakage**: Public API responses (`posts`, `comments`, `feed`, `communities`, `profiles`) and ordinary moderator views expose only community-scoped `Anonymous #XXXX` or anonymized IDs—never `users.id`, `authId`, phone, email, or IP addresses.
- [ ] **No Raw GPS Persistence**: Neither client nor backend persists exact `lat`/`lng` coordinates; location preferences use city/state or coarse k-anonymous geo-cells.
- [ ] **Server-Side Auth & RBAC**: JWT validation, ownership checks, 18+ gate, and Admin `RolesGuard` are enforced on the server, never solely in client UI.
- [ ] **Error Leak-Stop**: API returns structured `ErrorEnvelope`; `apps/mobile` renders vetted copy via `userMessageForCode` and never displays raw backend `error.message`.
- [ ] **Secrets Hygiene**: Zero `.env` files, tokens, or credentials committed; new env vars documented in `.env.example`.

## 6. Documentation & Contracts
- [ ] `packages/shared-types` and `packages/api-contracts/openapi.yaml` updated in lockstep for any DTO, enum, route, or Socket.IO event change.
- [ ] `CHANGE-MATRIX.md` and `apps/api/prisma/migrations/` updated when database schemas change.
- [ ] Relevant `README.md` or `docs/*` pages updated for operational or developer workflow changes.

## 7. Deployment, Staging & Ticket Closure
- [ ] Staging/local smoke verification completed (`pnpm run test:windows` or staging deployment health check `/v1/health` + `/docs`).
- [ ] GitHub Project item (`DIR-XXX`) moved to **Done**, linked to its merged PR, and assigned to the verified **Target Release** milestone.
