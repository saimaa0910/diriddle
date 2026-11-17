## 1. Task & Branch Information

- **Task ID**: `DIR-XXX`
- **Epic**: `DIR-EPXX`
- **Target Release Milestone**: <!-- Release 0.1 | Release 0.2 | Release 0.3 | Release 0.9 | Release 1.0 -->
- **Type**: <!-- feat | fix | chore | docs | refactor | test | ci -->
- **Branch**: <!-- feature/DIR-XXX-slug | bugfix/DIR-XXX-slug | release/x.y.z | hotfix/DIR-XXX-slug -->
- **Related Issue**: #

## 2. Description (What & Why)

<!-- Summarize what changed and why this approach was chosen. Reference any DRIFT-REGISTER.md or CHANGE-MATRIX.md impacts. -->

## 3. Changes Made

- **Backend (`apps/api`)**:
- **Database (`apps/api/prisma`)**:
- **API Contracts & Shared Types (`packages/*`)**:
- **Mobile / Windows Web (`apps/mobile`)**:
- **Admin Dashboard (`apps/admin`)**:
- **Docs & Infra (`docs/`, `.github/`, `infrastructure/`, `scripts/`)**:

## 4. Testing & Quality Gates

- [ ] Unit tests added/updated (`pnpm run test`)
- [ ] Real PostgreSQL integration tests verified (if DB/PostGIS/constraints touched)
- [ ] API e2e tests passed (`pnpm run test:e2e`)
- [ ] Lint passed (`pnpm run lint`)
- [ ] Format check passed (`pnpm run format:check`)
- [ ] Type-check passed (`pnpm run typecheck`)
- [ ] Workspace build passed (`pnpm run build`)
- [ ] Windows web smoke test verified (if UI/API changed)

## 5. Database and Configuration

- [ ] Prisma migration included & backward-compatible (or N/A)
- [ ] Environment variables documented in `.env.example` (or N/A)
- [ ] Confirmed no `.env`, API keys, tokens, or secrets are committed

## 6. Privacy, Security & Identity Isolation Review

- [ ] **Auth validated**: JWT / OTP verification enforced server-side
- [ ] **Authz validated**: Ownership checks & Admin `RolesGuard` enforced server-side
- [ ] **Sensitive info protected**: `ErrorEnvelope` leaks no stack traces/PII; mobile uses `userMessageForCode` leak-stop mapping
- [ ] **Location privacy checked**: No precise GPS coordinates (`lat`/`lng`) persisted or exposed in public DTOs
- [ ] **Anonymous identity protected**: Public post/comment/profile responses expose only community-scoped `Anonymous #XXXX`, never `users.id`, `authId`, phone, or email
- [ ] **Moderation / Audit logging**: Restricted admin actions & identity lookups record immutable `AuditLog` entries

## 7. Screenshots / API Examples

<!-- Paste Windows Expo Web / Admin screenshots or curl/Swagger examples for UI or API changes -->

## 8. Reviewer & DoD Checklist

- [ ] Meets all criteria in `docs/project-management/DEFINITION_OF_DONE.md`
- [ ] Code adheres to `docs/code-review-guidelines.md`
- [ ] `packages/shared-types` and `packages/api-contracts/openapi.yaml` updated if API shapes changed
- [ ] `DRIFT-REGISTER.md` updated if any temporary divergence remains

## 9. Final Status

- **Ready for**: <!-- Review | QA | Merge -->
