---
name: Technical Task / Debt / Research
about: Engineering task, infrastructure setup, refactoring, or technical debt tracked with DIR-XXX
title: "[TASK] DIR-XXX: "
labels: type:task, priority:P1
assignees: ""
---

## Ticket Metadata
- **Task ID**: `DIR-XXX`
- **Epic**: `DIR-EPXX`
- **Work Type**: `Engineering Task` <!-- Engineering Task | Technical Debt | Research / Investigation -->
- **Priority**: `P1` <!-- P0 | P1 | P2 | P3 -->
- **Estimate**: `3` <!-- Fibonacci: 1, 2, 3, 5, 8 (split if 13) -->
- **Component**: `devops` <!-- backend | mobile | admin | database | security | devops | qa -->
- **Target Milestone**: <!-- Release 0.1 – Engineering Alpha | Release 0.2 – Feature Alpha | Release 0.3 – Safety Beta | Release 0.9 – Release Candidate | Release 1.0 – MVP -->
- **Dependencies**: <!-- DIR-XXX -->

---

## Description
<!-- Technical objective, architectural context, and why this work is needed now -->

## Scope & Technical Tasks
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

## Acceptance Criteria
1. **Given** ..., **When** ..., **Then** ...
2. **Given** ..., **When** ..., **Then** ...

---

## Privacy & Security Check
- [ ] Reviewed for auth, RBAC, PII isolation (`users.id` non-leakage), secret hygiene, and CI/CD least-privilege permissions

## Testing Requirements
- [ ] Automated tests / verification script / CI workflow run passed
- [ ] Verified on Windows PowerShell and Linux/CI runners

## Definition of Done
- [ ] Meets all gates in `docs/project-management/DEFINITION_OF_DONE.md`
- [ ] `lint`, `format:check`, `typecheck`, `test`, `build` green
- [ ] Relevant docs (`README.md`, `DRIFT-REGISTER.md`, `CHANGE-MATRIX.md`) updated
