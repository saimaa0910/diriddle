# Definition of Done (DoD) — diriddle

A task (`DIR-XXX`), bug fix, or sprint increment is **Done** only when every applicable criterion below is satisfied.

## Complete Definition of Done Table

| Category | Requirement | Verification Method |
|---|---|---|
| **Code & Scope** | Acceptance criteria met; no unrelated changes or dead code | PR diff review |
| **Contracts & Types** | `packages/shared-types` and `packages/api-contracts/openapi.yaml` updated for any API/event change | `pnpm --filter @diriddle/shared-types build` |
| **Code Quality** | `pnpm run lint` and `pnpm run typecheck` pass with zero errors | CI (`pr-validation.yml`) & local run |
| **Testing** | Unit tests (`pnpm run test`) and API e2e tests (`pnpm run test:e2e`) added/updated and passing | Jest & Supertest output |
| **Build & Bundle** | `pnpm run build` passes (`@diriddle/api`, `@diriddle/admin`, `@diriddle/mobile` web export) | CI & local build output |
| **Windows Verification** | `scripts/start-windows-test.ps1` parses cleanly and Windows Web (`:8081`) / API (`:3000`) / Admin (`:3001`) start cleanly | Local Windows smoke check |
| **Privacy & Security** | Zero PII/`userId` in public DTOs; coarse location only; server-side auth & RBAC verified; no committed secrets | `docs/code-review-guidelines.md` checklist |
| **Database** | Prisma migration added and tested if schema changed; seed script updated if needed | `prisma generate` / `migrate deploy` |
| **Documentation** | `README.md`, `docs/*`, `DRIFT-REGISTER.md`, or `CHANGE-MATRIX.md` updated when behavior or contracts change | PR review |
| **Review & QA** | Approved by peer + `CODEOWNERS` (when required) and verified by QA (`docs/qa-process.md`) | GitHub PR status & QA sign-off |

---

## 2-Week Sprint Cadence

| Day | Ceremony / Activity | Goal |
|---|---|---|
| **Day 1 (Mon W1)** | Sprint Planning | Commit to `DIR-XXX` scope; validate dependencies & `CHANGE-MATRIX.md` |
| **Days 2–8** | Build, Review & Continuous QA | Small PRs to `develop`; incremental QA verification on Windows & Staging |
| **Day 9 (Thu W2)** | Code Freeze & RC Cut | Cut `release/*` from `develop`; run full regression & QA matrix |
| **Day 10 (Fri W2)** | Release, Demo & Retro | Deploy verified release, tag `vX.Y.Z`, demo working software, capture action items |

---

## Non-Negotiable Completion Rule

> **No task is considered Done until it is built, tested (`test` + `test:e2e`), type-checked, linted, privacy-reviewed, and verified end-to-end without skipped assertions or unverified assumptions.**
