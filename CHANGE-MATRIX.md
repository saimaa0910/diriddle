# Change Matrix

Cross-workspace impact matrix for `diriddle`. Consult before modifying shared contracts, schemas, or infrastructure.

| Change Type | Primary Package / Path | Downstream Impacted Workspaces | Required Verification Steps |
|---|---|---|---|
| Shared enum or DTO update | `packages/shared-types/src/index.ts` | `apps/api`, `apps/mobile`, `apps/admin` | `pnpm --filter @diriddle/shared-types build`; `pnpm run type-check`; `pnpm run test` |
| REST `/v1` API contract change | `packages/api-contracts/openapi.yaml` | `apps/api`, `apps/mobile`, `apps/admin` | Verify Swagger `/docs`, API e2e tests, and mobile/admin API clients |
| Realtime Socket.IO event change | `packages/shared-types` (`RealtimeEvents`), `apps/api/src/realtime` | `apps/mobile`, `apps/admin` | Verify `CommunityGateway` room emission & mobile Socket.IO listeners |
| Database schema / migration change | `apps/api/prisma/schema.prisma` | `apps/api`, `infrastructure/docker`, CI | `npx prisma migrate dev`; `npx prisma generate`; run API integration tests |
| Docker / local runtime ports | `infrastructure/docker/docker-compose.*.yml` | `scripts/start-windows-test.ps1`, `apps/api/.env*`, `.github/workflows/ci.yml` | Run `scripts/start-windows-test.ps1` and verify health endpoints |
| Design system tokens | `apps/mobile/src/design-system/tokens.ts`, `apps/admin/tailwind.config.ts` | `apps/mobile`, `apps/admin` | Run `apps/mobile` Jest token tests and `apps/admin` build |
