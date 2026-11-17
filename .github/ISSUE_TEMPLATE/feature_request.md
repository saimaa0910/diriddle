---
name: Feature Request / User Story
about: Propose or track a diriddle product feature story with DIR-XXX backlog fields
title: "[FEAT] DIR-XXX: "
labels: type:story, priority:P1
assignees: ""
---

## Ticket Metadata
- **Task ID**: `DIR-XXX`
- **Epic**: `DIR-EPXX`
- **Priority**: `P1` <!-- P0 | P1 | P2 | P3 -->
- **Estimate**: `5` <!-- Fibonacci: 1, 2, 3, 5, 8 (split if 13) -->
- **Component**: `mobile` <!-- backend | mobile | admin | database | security | devops | qa -->
- **Target Milestone**: <!-- Release 0.1 – Engineering Alpha | Release 0.2 – Feature Alpha | Release 0.3 – Safety Beta | Release 0.9 – Release Candidate | Release 1.0 – MVP -->
- **Dependencies**: <!-- DIR-XXX -->

---

## Description
<!-- Feature requirement and business/product purpose -->

## User Story
As a **[anonymous user / moderator / admin]**,  
I want **[capability]**,  
so that **[measurable user or safety outcome]**.

## Acceptance Criteria
1. **Given** ..., **When** ..., **Then** ...
2. **Given** ..., **When** ..., **Then** ...
3. **Given** ..., **When** ..., **Then** ...

## Technical Tasks
- [ ] Update `packages/shared-types` & `packages/api-contracts/openapi.yaml` (if contract changes)
- [ ] Backend service/controller/migration (`apps/api`)
- [ ] Client UI & error leak-stop handling (`apps/mobile` / `apps/admin`)
- [ ] Windows Web (`Platform.OS === 'web'`) & `DEV_IN_MEMORY=true` compatibility verified

---

## Privacy & Security Check
- [ ] Public DTOs expose only `Anonymous #XXXX` (never `users.id`, `authId`, phone, or email)
- [ ] No precise GPS coordinates persisted or transmitted
- [ ] Server-side JWT / ownership / `RolesGuard` enforced
- [ ] `userMessageForCode` maps error codes safely without showing raw backend messages

## Testing Requirements
- [ ] Unit tests (`pnpm run test`)
- [ ] Real PostgreSQL integration / API e2e tests (`pnpm run test:e2e`)
- [ ] Windows Expo Web / Next.js Admin manual smoke verification

## Definition of Done
- [ ] All acceptance criteria verified
- [ ] `lint`, `format:check`, `typecheck`, `test`, `test:e2e`, `build` green
- [ ] Docs & `DRIFT-REGISTER.md` updated if applicable
