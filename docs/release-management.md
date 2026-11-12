# Release Management — diriddle (Stage 07 & Stage 08)

This document covers creating release candidates, promoting from Staging to Production, handling database migrations/rollbacks, and post-release verification.

## Stage 07: Release Branch Flow

1. **Create Release Branch** from `develop` once all sprint `DIR-XXX` tickets are QA-verified:
   ```powershell
   git checkout develop; git pull origin develop
   git checkout -b release/v1.0.0
   ```
2. **Bump Version & Update Changelog / Drift Register** (`package.json`, `DRIFT-REGISTER.md`).
3. **Run Full Verification**:
   - `pnpm install --frozen-lockfile`
   - `pnpm run lint; pnpm run typecheck; pnpm run test; pnpm run test:e2e; pnpm run build`
4. **Deploy to Staging** via `.github/workflows/deploy-staging.yml` (`workflow_dispatch` or `staging` branch).

---

## Release Candidate (RC) Checklist

- [ ] All targeted `DIR-XXX` issues marked `Ready for Release` / `QA Pass`
- [ ] Zero open `Critical` or `High` bugs
- [ ] `packages/api-contracts/openapi.yaml` matches live NestJS Swagger (`/docs-json`)
- [ ] Prisma migrations tested against a staging PostgreSQL + PostGIS instance (`prisma migrate deploy`)
- [ ] Docker API build passes (`docker build -f infrastructure/docker/Dockerfile.api .`)
- [ ] Mobile Windows Web export (`npx expo export --platform web`) and Admin Next.js build succeed cleanly

---

## Staging-to-Production Gates

| Gate | Requirement | Owner |
|---|---|---|
| **Automated CI** | `pr-validation.yml` & `deploy-staging.yml` green | CI / Infra |
| **Staging Smoke** | Auth OTP, Feed, Create Post, Report/Block, Admin Moderation verified on Staging | QA |
| **Security & Privacy** | `CODEOWNERS` sign-off on any auth/identity/location/moderation changes | `@saimaa0910` |
| **DB Safety** | Migrations verified backward-compatible with currently running API version | Backend Lead |
| **Go / No-Go** | Explicit release approval recorded | Release Manager |

---

## Database Migration, Rollback & Forward-Fix Rules

1. **Expand-and-Contract Migrations**: Never drop or rename live columns in the same release that removes application references; split destructive changes across two releases.
2. **Never Edit Applied Migrations**: Once `apps/api/prisma/migrations/<timestamp>_*` is applied to Staging or Production, treat it as immutable.
3. **Application Rollback**: If an application regression occurs without incompatible schema changes, redeploy the previous Docker image tag (`diriddle-api:<prev-sha>`).
4. **Schema Forward-Fix Policy**: Do **not** run destructive `DROP` rollbacks on Production databases. Instead, deploy a forward-fix migration or toggle feature behavior while preserving user/audit data.

---

## Stage 08: Post-Release Monitoring Metrics

Monitor these indicators for at least **60 minutes** immediately after Production deployment:

| Metric | Target / Alert Threshold |
|---|---|
| **API Availability (`/v1/health`)** | `99.9%+` (`200 OK`) |
| **HTTP 5xx Error Rate** | `< 0.5%` of total requests |
| **Feed & Post P95 Latency** | `< 350ms` (`GET /v1/feed/*`, `POST /v1/posts`) |
| **Auth OTP Success Rate** | `> 98%` (excluding expected rate-limit `429`s) |
| **Moderation Queue / Auto-Filter** | No backlog spike; `AuditLog` writes succeeding |
| **Socket.IO Connections** | Stable reconnect rate; zero auth bypass warnings |

---

## Closing & Tagging the Release

Once Staging & Production verification succeed:

```powershell
git checkout main; git pull origin main
git merge --no-ff release/v1.0.0 -m "chore(release): release v1.0.0"
git tag -a v1.0.0 -m "diriddle v1.0.0"
git push origin main --tags

git checkout develop; git pull origin develop
git merge --no-ff release/v1.0.0 -m "chore(release): sync develop with v1.0.0"
git push origin develop
git branch -d release/v1.0.0
```
