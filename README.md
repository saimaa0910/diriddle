# diriddle — Anonymous Local Social Network (India)

`diriddle` is an anonymous, hyperlocal social network built for Indian cities, neighborhoods, and campuses.

## Architecture Overview

| Workspace | Stack | Port | Description |
|---|---|---|---|
| `apps/api` | NestJS 10, Prisma 5, Socket.IO, Swagger | `3000` | Modular monolith backend (`/v1` REST + `/docs` Swagger + Socket.IO) |
| `apps/mobile` | Expo ~53, Expo Router, React Native Web | `8081` | Mobile app (iOS/Android) + **Windows Web test client** |
| `apps/admin` | Next.js 15, React 19, Tailwind CSS | `3001` | Trust & Safety, Moderation Queue, Analytics & Audit Log Dashboard |
| `packages/shared-types` | TypeScript | — | Shared enums, DTOs, `ErrorEnvelope`, `PaginatedResponse<T>`, `RealtimeEvents` |
| `packages/api-contracts` | OpenAPI 3.1.0 | — | Full `/v1` API contract (`openapi.yaml`) |

Infrastructure:
- **PostgreSQL 16 + PostGIS 3.4** (`5432` dev / `5433` test)
- **Redis 7.2** (`6379` dev / `6380` test)

---

## Windows-First Quick Start & Testing

You can test the entire `diriddle` platform directly on **Windows 10/11** (PowerShell or Command Prompt) using either Docker (full PostgreSQL + Redis) or **Demo In-Memory Mode** (zero Docker required).

### Prerequisites

- **Node.js** `>= 20.0.0`
- **pnpm** `>= 9.0.0` (`npm install -g pnpm@9`)
- **Docker Desktop** *(optional — if Docker is not running, the launcher automatically runs the API in `DEV_IN_MEMORY=true` test mode)*

### 1. Install dependencies & build shared types

```powershell
pnpm install
pnpm --filter @diriddle/shared-types build
```

### 2. One-Command Windows Test Launcher

Run via pnpm:

```powershell
pnpm run test:windows
```

Or double-click / run directly:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-windows-test.ps1
```

Or from `cmd.exe`:

```bat
scripts\start-windows-test.bat
```

What the launcher does:
1. Verifies `node`, `pnpm`, and Docker daemon status.
2. Starts `infrastructure/docker/docker-compose.dev.yml` if Docker is running; otherwise prints a notice and sets `DEV_IN_MEMORY=true` for immediate local testing.
3. Copies `.env.example` to `.env` for `apps/api`, `apps/mobile`, and `apps/admin` if missing.
4. Builds `@diriddle/shared-types`, and runs `prisma generate`, `prisma migrate deploy` (or `db push`), and `prisma db seed` when PostgreSQL is reachable.
5. Launches:
   - **Backend API**: `http://localhost:3000/v1` (Swagger UI: `http://localhost:3000/docs`)
   - **Windows Web App (Expo Web)**: `http://localhost:8081`
   - **Admin Dashboard**: `http://localhost:3001`

> **Tip:** Pass `-Jobs` (`powershell -ExecutionPolicy Bypass -File scripts/start-windows-test.ps1 -Jobs`) to run all three services as managed background jobs inside a single terminal instead of opening separate PowerShell windows.

---

## Manual Setup & Commands

### Start Docker Databases Only

```powershell
docker compose -f infrastructure/docker/docker-compose.dev.yml up -d
```

### Database Migration & Seed

```powershell
pnpm --filter @diriddle/api exec prisma generate
pnpm --filter @diriddle/api exec prisma migrate dev
pnpm --filter @diriddle/api run db:seed
```

### Build, Lint, Type-Check & Test

```powershell
pnpm run build
pnpm run type-check
pnpm run lint
pnpm run test
```

### Test Docker Environment (Isolated Ports 5433 / 6380)

```powershell
docker compose -f infrastructure/docker/docker-compose.test.yml up -d
```

---

## Key Governance & Contract Files

- [`packages/shared-types/src/index.ts`](packages/shared-types/src/index.ts) — Canonical shared enums & DTOs
- [`packages/api-contracts/openapi.yaml`](packages/api-contracts/openapi.yaml) — OpenAPI 3.1.0 `/v1` specification
- [`DRIFT-REGISTER.md`](DRIFT-REGISTER.md) — Tracked specification vs. implementation deltas
- [`CHANGE-MATRIX.md`](CHANGE-MATRIX.md) — Cross-workspace change impact matrix
- [`context.yaml`](context.yaml) — Platform metadata & bounded contexts
