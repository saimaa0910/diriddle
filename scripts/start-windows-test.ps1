<#
.SYNOPSIS
    Windows-first launcher for the diriddle local testing stack.
.DESCRIPTION
    Checks Node, pnpm, and Docker status; starts PostgreSQL+PostGIS & Redis via
    Docker Compose (or falls back cleanly to DEV_IN_MEMORY=true demo mode if Docker
    is unavailable); copies missing .env files; runs Prisma generate/migrate/seed
    when DB is reachable; and launches API (3000), Mobile Web (8081), and Admin (3001).
.PARAMETER Jobs
    Run services as background PowerShell jobs in the current window instead of
    opening separate PowerShell windows.
#>
[CmdletBinding()]
param(
    [switch]$Jobs
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  [!]  $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  [ERR] $msg" -ForegroundColor Red }

function Test-TcpPort {
    param([string]$TargetHost = '127.0.0.1', [int]$Port = 5432, [int]$TimeoutMs = 1000)
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect($TargetHost, $Port, $null, $null)
        $wait = $iar.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
        if ($wait -and $client.Connected) {
            $client.EndConnect($iar)
            $client.Close()
            return $true
        }
        $client.Close()
        return $false
    } catch {
        return $false
    }
}

Write-Host "=========================================================" -ForegroundColor Magenta
Write-Host "  diriddle - Windows Local Test Environment Launcher" -ForegroundColor Magenta
Write-Host "=========================================================" -ForegroundColor Magenta

# 1. Check Node & pnpm
Write-Step "Checking prerequisites (Node, pnpm, Docker)..."
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Err "Node.js is not installed or not in PATH. Install Node >= 20 and retry."
    exit 1
}
$nodeVer = (& node -v).Trim()
Write-Ok "Node.js $nodeVer"

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Err "pnpm is not installed. Run: npm install -g pnpm@9"
    exit 1
}
$pnpmVer = (& pnpm -v).Trim()
Write-Ok "pnpm $pnpmVer"

if (-not (Test-Path (Join-Path $RepoRoot 'node_modules'))) {
    Write-Warn "Root node_modules not found. Running 'pnpm install'..."
    & pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Err "pnpm install failed."
        exit 1
    }
}

# 2. Copy .env.example -> .env if missing
Write-Step "Checking environment files..."
foreach ($app in @('apps/api', 'apps/mobile', 'apps/admin')) {
    $example = Join-Path $RepoRoot "$app/.env.example"
    $envFile = Join-Path $RepoRoot "$app/.env"
    if ((Test-Path $example) -and -not (Test-Path $envFile)) {
        Copy-Item $example $envFile
        Write-Ok "Created $app/.env from .env.example"
    } elseif (Test-Path $envFile) {
        Write-Ok "$app/.env already exists"
    }
}

# 3. Check Docker daemon & start databases or fall back to DEV_IN_MEMORY
Write-Step "Checking Docker & Database availability..."
$dockerAvailable = $false
$dbReachable = $false

if (Get-Command docker -ErrorAction SilentlyContinue) {
    $null = & docker info 2>&1
    if ($LASTEXITCODE -eq 0) {
        $dockerAvailable = $true
        Write-Ok "Docker daemon is running"
    } else {
        Write-Warn "Docker CLI found, but Docker daemon is not running."
    }
} else {
    Write-Warn "Docker is not installed."
}

$composeFile = Join-Path $RepoRoot 'infrastructure/docker/docker-compose.dev.yml'
if ($dockerAvailable -and (Test-Path $composeFile)) {
    Write-Step "Starting PostgreSQL + PostGIS and Redis via Docker Compose..."
    & docker compose -f $composeFile up -d
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Waiting for PostgreSQL on localhost:5432..." -NoNewline
        for ($i = 0; $i -lt 20; $i++) {
            if (Test-TcpPort -TargetHost '127.0.0.1' -Port 5432) {
                $dbReachable = $true
                break
            }
            Start-Sleep -Seconds 1
            Write-Host "." -NoNewline
        }
        Write-Host ""
        if ($dbReachable) {
            Write-Ok "PostgreSQL is reachable at localhost:5432"
        } else {
            Write-Warn "PostgreSQL did not become ready on port 5432 in time."
        }
    } else {
        Write-Warn "docker compose up failed."
    }
} elseif (Test-TcpPort -TargetHost '127.0.0.1' -Port 5432) {
    $dbReachable = $true
    Write-Ok "PostgreSQL already reachable at localhost:5432"
}

$useInMemory = -not $dbReachable
if ($useInMemory) {
    Write-Warn "Database is not running. Launching API in DEV_IN_MEMORY=true demo/test mode!"
    Write-Warn "All endpoints (OTP: 123456, cities, posts, comments, moderation) work without Docker."
}

# 4. Build shared types & prepare Prisma
Write-Step "Building @diriddle/shared-types..."
& pnpm --filter @diriddle/shared-types build
if ($LASTEXITCODE -ne 0) {
    Write-Err "Failed to build @diriddle/shared-types"
    exit 1
}
Write-Ok "@diriddle/shared-types built"

Write-Step "Preparing Prisma client..."
& pnpm --filter @diriddle/api exec prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Warn "prisma generate returned non-zero status; continuing."
}

if ($dbReachable) {
    Write-Step "Running Prisma migrations and database seed..."
    Push-Location (Join-Path $RepoRoot 'apps/api')
    try {
        & npx prisma migrate deploy
        if ($LASTEXITCODE -ne 0) {
            Write-Warn "migrate deploy failed; trying prisma db push..."
            & npx prisma db push --skip-generate
        }
        & pnpm run db:seed
        Write-Ok "Database migrated and seeded with Indian cities"
    } finally {
        Pop-Location
    }
}

# 5. Launch API, Mobile Web (Windows test app), and Admin Dashboard
Write-Step "Launching diriddle services..."
$apiEnvPrefix = if ($useInMemory) { "`$env:DEV_IN_MEMORY='true'; " } else { "`$env:DEV_IN_MEMORY='false'; " }

$apiCmd    = "Set-Location '$RepoRoot'; $apiEnvPrefix pnpm --filter @diriddle/api dev"
$mobileCmd = "Set-Location '$RepoRoot'; `$env:EXPO_PUBLIC_API_URL='http://localhost:3000/v1'; pnpm --filter @diriddle/mobile dev"
$adminCmd  = "Set-Location '$RepoRoot'; `$env:NEXT_PUBLIC_API_URL='http://localhost:3000/v1'; pnpm --filter @diriddle/admin dev"

if ($Jobs) {
    $jobApi    = Start-Job -Name 'diriddle-api'    -ScriptBlock { param($c) Invoke-Expression $c } -ArgumentList $apiCmd
    $jobMobile = Start-Job -Name 'diriddle-mobile' -ScriptBlock { param($c) Invoke-Expression $c } -ArgumentList $mobileCmd
    $jobAdmin  = Start-Job -Name 'diriddle-admin'  -ScriptBlock { param($c) Invoke-Expression $c } -ArgumentList $adminCmd

    Write-Ok "Started background jobs: diriddle-api, diriddle-mobile, diriddle-admin"
    Write-Host "`nService URLs:" -ForegroundColor Cyan
    Write-Host "  Backend API : http://localhost:3000/v1" -ForegroundColor White
    Write-Host "  Swagger Docs: http://localhost:3000/docs" -ForegroundColor White
    Write-Host "  Windows App : http://localhost:8081  (Expo Web)" -ForegroundColor White
    Write-Host "  Admin Panel : http://localhost:3001" -ForegroundColor White
    Write-Host "`nPress Ctrl+C to stop all services..." -ForegroundColor Yellow

    try {
        while ($true) {
            foreach ($j in @($jobApi, $jobMobile, $jobAdmin)) {
                $out = Receive-Job -Job $j -ErrorAction SilentlyContinue
                if ($out) {
                    $out | ForEach-Object { Write-Host "[$($j.Name)] $_" }
                }
            }
            Start-Sleep -Seconds 2
        }
    } finally {
        Write-Step "Stopping diriddle background jobs..."
        Stop-Job -Job $jobApi, $jobMobile, $jobAdmin -ErrorAction SilentlyContinue
        Remove-Job -Job $jobApi, $jobMobile, $jobAdmin -Force -ErrorAction SilentlyContinue
        Write-Ok "All services stopped."
    }
} else {
    $psExe = if (Get-Command pwsh -ErrorAction SilentlyContinue) { 'pwsh' } else { 'powershell' }

    Start-Process $psExe -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $apiCmd
    Start-Process $psExe -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $mobileCmd
    Start-Process $psExe -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $adminCmd

    Write-Ok "Launched 3 PowerShell windows for API, Mobile Web, and Admin Dashboard."
    Write-Host "`nService URLs (allow ~15s for initial compilation):" -ForegroundColor Cyan
    Write-Host "  Backend API : http://localhost:3000/v1" -ForegroundColor White
    Write-Host "  Swagger Docs: http://localhost:3000/docs" -ForegroundColor White
    Write-Host "  Windows App : http://localhost:8081  (Expo Web)" -ForegroundColor White
    Write-Host "  Admin Panel : http://localhost:3001" -ForegroundColor White
}
