## 1. Task Information

- **Jira / Task ID**: `DIR-XXX`
- **Type**: <!-- feat | fix | chore | docs | refactor | test -->
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

## 4. Testing

- [ ] Unit tests added/updated (`pnpm run test`)
- [ ] Integration tests verified
- [ ] API e2e tests passed (`pnpm run test:e2e`)
- [ ] Lint passed (`pnpm run lint`)
- [ ] Type-check passed (`pnpm run typecheck`)
- [ ] Workspace build passed (`pnpm run build`)
- [ ] Windows web smoke test verified (if UI/API changed)
- **Security implications**: <!-- Describe any auth, RBAC, rate-limit, or data exposure impact -->

## 5. Database and Configuration

- [ ] Prisma migration included & backward-compatible (or N/A)
- [ ] Environment variables documented in `.env.example` (or N/A)
- [ ] Confirmed no `.env`, API keys, tokens, or secrets are committed

## 6. Security Review

- [ ] **Auth validated**: JWT / OTP verification enforced server-side
- [ ] **Authz validated**: Ownership checks & Admin `RolesGuard` enforced server-side
- [ ] **Sensitive info protected**: `ErrorEnvelope` leaks no stack traces/PII; mobile uses leak-stop error mapping
- [ ] **Location privacy checked**: No precise GPS coordinates stored or exposed in public DTOs
- [ ] **Anonymous identity protected**: Public post/comment/profile responses expose only `Anonymous #XXXX`, never `userId`, `authId`, phone, or email

## 7. Screenshots / API Examples

<!-- Paste Windows Expo Web / Admin screenshots or curl/Swagger examples for UI or API changes -->

## 8. Reviewer Checklist

- [ ] Code adheres to `docs/code-review-guidelines.md`
- [ ] `packages/shared-types` and `packages/api-contracts/openapi.yaml` updated if API shapes changed
- [ ] No unintended cross-package regressions

## 9. Final Status

- **Ready for**: <!-- Review | QA | Merge -->
