---
name: Bug Report (Standardized)
about: Report a bug, regression, or privacy/security defect tracked with DIR-XXX backlog fields
title: "[BUG] DIR-XXX: "
labels: type:bug, priority:P1
assignees: ""
---

## Ticket Metadata
- **Task ID**: `DIR-XXX`
- **Epic**: `DIR-EPXX`
- **Priority**: `P0` <!-- P0 | P1 | P2 | P3 -->
- **Estimate**: `2` <!-- Fibonacci: 1, 2, 3, 5, 8 -->
- **Component**: `backend` <!-- backend | mobile | admin | database | security | devops | qa -->
- **Target Milestone**: <!-- Release 0.1 – Engineering Alpha | Release 0.2 – Feature Alpha | Release 0.3 – Safety Beta | Release 0.9 – Release Candidate | Release 1.0 – MVP -->

---

## Bug Description
<!-- Clear summary of the defect and its impact on users, moderators, or local Windows testing -->

## Environment
- [ ] Windows Local (`DEV_IN_MEMORY=true` / Expo Web `:8081` / Admin `:3001`)
- [ ] Docker Local (PostgreSQL + PostGIS + Redis)
- [ ] Staging
- [ ] Production
- **Branch / Commit SHA**:

## Steps to Reproduce
1.
2.
3.

## Expected Behavior (Given / When / Then)
- **Given** ...
- **When** ...
- **Then** ...

## Actual Behavior
<!-- Exact error code, HTTP status, ErrorEnvelope, Jest failure, or browser console trace -->

---

## Privacy & Security Check
- [ ] Confirmed whether this bug leaks `users.id`, `authId`, phone, email, or precise GPS coordinates (`lat`/`lng`).
- [ ] If PII/anonymity/auth bypass risk exists, escalate immediately to `priority:P0` and `area:security`.

## Testing Requirements
- [ ] Regression unit test added (`apps/api` / `apps/mobile` / `apps/admin`)
- [ ] API e2e / real PostgreSQL integration test updated (if backend/DB)
- [ ] Windows Web / Admin smoke test verified

## Definition of Done
- [ ] Root cause fixed with clean minimal diff
- [ ] `pnpm run lint`, `pnpm run format:check`, `pnpm run typecheck`, `pnpm run test`, `pnpm run test:e2e`, and `pnpm run build` pass
- [ ] `DRIFT-REGISTER.md` / `openapi.yaml` updated if behavior changed
