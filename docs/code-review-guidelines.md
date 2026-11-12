# Code Review Guidelines — diriddle (Stage 05)

Code reviews protect system correctness, user anonymity, location privacy, and maintainability across the `diriddle` monorepo.

## Stage 05 Automated CI Checks

Every Pull Request targeting `develop` or `main` triggers `.github/workflows/pr-validation.yml`. All checks below must be green before human approval:

1. `pnpm install --frozen-lockfile`
2. `pnpm --filter @diriddle/shared-types build`
3. `pnpm --filter @diriddle/api exec prisma generate`
4. `pnpm run lint`
5. `pnpm run type-check`
6. `pnpm run test`
7. `pnpm run test:e2e` (`DEV_IN_MEMORY=true`)
8. `pnpm run build`
9. Dependency audit & secret hygiene scan (no `.env` or private keys committed)

---

## Code Review Evaluation Matrix

| Area | What Reviewers Check |
|---|---|
| **Architecture & Contracts** | Changes match `packages/api-contracts/openapi.yaml` and `packages/shared-types`; no duplicated business logic across modules |
| **Correctness & Edge Cases** | Input validation (`class-validator`), cursor pagination boundaries, idempotency keys, null/empty states |
| **Error Handling** | Backend throws NestJS HTTP exceptions mapped to `ErrorEnvelope`; mobile uses `user-message-for-code.ts` (never renders raw backend `error.message`) |
| **Database & Migrations** | Backward-compatible Prisma migrations, proper indexes, `CHECK (blocker_id <> blocked_id)` and soft-delete filters (`deletedAt: null`) preserved |
| **Cross-Platform (Windows + Mobile)** | New mobile APIs guard `Platform.OS === 'web'` so `expo start --web` and `expo export --platform web` work cleanly on Windows |
| **Test Coverage** | New services/endpoints have unit + e2e coverage; existing tests were not weakened or skipped |

---

## diriddle Privacy & Security Checklist (Mandatory)

Reviewers MUST explicitly verify these three invariants on every backend, mobile, and admin PR:

1. **Anonymous Identity Protection**
   - Public post, comment, feed, and community responses ONLY expose `anonymous_name` (e.g. `Anonymous #0042`) — never `userId`, `authId`, phone number, or email.
   - `IdentitiesService` private lookup endpoints are restricted to authorized trust/safety roles and write an immutable `AuditLog` entry on every access.
   - Ordinary moderators in `apps/admin` see anonymized IDs only.
2. **Location Privacy**
   - Public APIs and database models store only coarse city/state/community or coarse geo-cell identifiers — never raw GPS latitude/longitude per post or user.
   - Location privacy threshold checks (k-anonymity) are enforced before surfacing neighborhood-level activity.
3. **Server-Authoritative Authentication & Authorization**
   - JWT validation (`AuthGuard('jwt')`), 18+ age verification, ownership checks (`post.userId === user.id`), and admin RBAC (`RolesGuard`) are enforced server-side, never trusted from client headers or body fields.
   - Socket.IO `CommunityGateway` validates handshake auth and community membership before joining rooms.

---

## Review Decisions

| Decision | When to Use |
|---|---|
| **Approve** | All CI checks pass, privacy/security checks verified, and no blocking defects remain |
| **Comment** | Non-blocking suggestions, questions, or minor style notes (`nit:`) |
| **Request Changes** | Failing CI, missing tests, contract mismatch, or any security/privacy/anonymity risk |

---

## Branch Protection & Merge Policy

- **Protected Branches**: `main` and `develop`
- **Minimum Approvals**: At least **1 approving review** (plus `CODEOWNERS` approval from `@saimaa0910` for `prisma/`, `auth/`, `identities/`, `location/`, `moderation/`, `packages/api-contracts/`, and `.github/`)
- **Required Status Checks**: `Lint, Type-Check, Tests & Build` and `Dependency Audit & Secret Hygiene`
- **Merge Method**: **Squash and merge** for `feature/*` and `bugfix/*` into `develop` (keeps history linear); **Merge commit** (no fast-forward) for `release/*` and `hotfix/*` into `main` so release tags remain traceable
- **No Direct Pushes**: Direct commits to `main` and `develop` are disabled once branch protection is active
