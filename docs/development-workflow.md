# Development Workflow — diriddle

This guide defines the end-to-end engineering delivery lifecycle for `diriddle` across `apps/api`, `apps/mobile` (including Windows Web), `apps/admin`, and `packages/*`.

## Delivery Lifecycle Overview (Stages 01–08)

| Stage | Name | Primary Owner | Exit Criteria |
|---|---|---|---|
| **01** | **Intake & Triage** | Product / Tech Lead | Issue logged using `.github/ISSUE_TEMPLATE/*` with `DIR-XXX` ID & priority |
| **02** | **Contract & Schema Design** | Backend / Infra | `packages/shared-types` & `packages/api-contracts/openapi.yaml` updated; `CHANGE-MATRIX.md` checked |
| **03** | **Branching & Local Setup** | Developer | Feature/bugfix branch off `develop`; local Windows or Docker environment healthy |
| **04** | **Implementation & Local Gates** | Developer | Code, unit/e2e tests, lint, typecheck, and build pass locally |
| **05** | **Pull Request & Code Review** | Reviewers + `CODEOWNERS` | `pr-validation.yml` green; security & privacy checklist verified; approval granted |
| **06** | **QA Verification** | QA / Verifier | Test matrix & regression scenarios verified on QA/Staging (including Windows Web) |
| **07** | **Release & Deployment** | Release Manager | `release/*` RC verified in Staging, tagged, merged to `main` & `develop` |
| **08** | **Post-Release Monitoring** | On-Call / Ops | Health, error rates, moderation SLA, and metrics stable; release closed |

---

## Stage 04 — Local Implementation Steps (1–6)

Before opening a Pull Request, run all 6 local verification steps from the repository root (`c:\Users\admin\Desktop\diriddle`):

1. **Sync & Install Dependencies**
   ```powershell
   git fetch origin; git rebase origin/develop
   pnpm install
   ```
2. **Build Shared Contracts & Generate Prisma Client**
   ```powershell
   pnpm --filter @diriddle/shared-types build
   pnpm --filter @diriddle/api exec prisma generate
   ```
3. **Run Lint & Type-Check**
   ```powershell
   pnpm run lint
   pnpm run typecheck
   ```
4. **Run Unit & E2E Tests**
   ```powershell
   pnpm run test
   $env:DEV_IN_MEMORY="true"; pnpm run test:e2e
   ```
5. **Run Full Workspace Build**
   ```powershell
   pnpm run build
   ```
6. **Windows-First End-to-End Smoke Test**
   ```powershell
   pnpm run test:windows
   ```
   Verify API (`http://localhost:3000/docs`), Expo Web (`http://localhost:8081`), and Admin (`http://localhost:3001`).

---

## Branching Strategy

| Branch | Purpose | Source Branch | Merge Target |
|---|---|---|---|
| `main` | Production-ready releases only (tagged `vX.Y.Z`) | `release/*` or `hotfix/*` | — |
| `develop` | Integration branch for next scheduled release | `main` | — |
| `feature/DIR-XXX-slug` | New capabilities and enhancements | `develop` | `develop` |
| `bugfix/DIR-XXX-slug` | Non-production defect fixes | `develop` | `develop` |
| `release/vX.Y.Z` | Release candidate stabilization & QA sign-off | `develop` | `main` & `develop` |
| `hotfix/DIR-XXX-slug` | Urgent production fixes | `main` | `main` & `develop` |

---

## Conventional Commits

All commits and PR titles MUST follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<scope>): <short imperative summary>
```

- **Types**: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`, `perf`, `build`
- **Scopes**: `api`, `mobile`, `admin`, `shared-types`, `api-contracts`, `infra`, `scripts`, `docs`
- **Examples**:
  - `feat(api): add community-scoped anonymous identity rotation`
  - `fix(mobile): pin react and react-dom to 18.3.1 in metro config`
  - `docs(workflow): add Stage 06 QA test matrix`

---

## 10-Step Working Agreement

1. **Contracts First**: Update `packages/shared-types` and `packages/api-contracts/openapi.yaml` before changing API payloads.
2. **Privacy by Default**: Never expose `userId`, `authId`, phone, email, or exact GPS coordinates in public DTOs or logs.
3. **Windows-Compatible Commands**: Keep scripts and docs functional on Windows PowerShell (`;` separator, web-safe Expo fallbacks).
4. **Small, Focused PRs**: Keep PRs scoped to a single `DIR-XXX` task; split large refactors.
5. **Never Skip Local Gates**: `lint`, `typecheck`, `test`, `test:e2e`, and `build` must pass before requesting review.
6. **Zero Secrets in Git**: Never commit `.env`, tokens, or private keys; update `.env.example` when adding env vars.
7. **Deterministic Migrations**: Prisma schema changes require an idempotent SQL migration in `apps/api/prisma/migrations/`.
8. **Update Drift & Change Docs**: Log intentional spec/implementation gaps in `DRIFT-REGISTER.md`.
9. **Respect CODEOWNERS**: Changes in `auth/`, `identities/`, `location/`, `moderation/`, `prisma/`, or `.github/` require owner review.
10. **Clean Up Before Done**: Remove temporary debug logs, dead code, and verify `docs/definition-of-done.md`.
