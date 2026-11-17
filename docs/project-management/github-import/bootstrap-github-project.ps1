<#
.SYNOPSIS
  Bootstraps GitHub labels, milestones, epics, issues, and GitHub Project ("diriddle - Product Development")
  using the GitHub CLI (`gh`) once authenticated.

.EXAMPLE
  pwsh -ExecutionPolicy Bypass -File .\docs\project-management\github-import\bootstrap-github-project.ps1 -Owner saimaa0910 -Repo diriddle
#>
param(
  [string]$Owner = "saimaa0910",
  [string]$Repo = "diriddle",
  [string]$ProjectTitle = "diriddle - Product Development",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoSlug = "$Owner/$Repo"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI (gh) is not installed. Install via: winget install GitHub.cli"
}

if (-not $DryRun) {
  gh auth status | Out-Null
}

Write-Host "=== 1. Creating Labels ===" -ForegroundColor Cyan
$labels = Import-Csv (Join-Path $ScriptDir "labels.csv") -Encoding UTF8
foreach ($label in $labels) {
  if ($DryRun) {
    Write-Host "[DRY-RUN] gh label create '$($label.name)' --color '$($label.color)' --repo $RepoSlug --force"
  } else {
    gh label create $label.name --color $label.color --description $label.description --repo $RepoSlug --force
  }
}

Write-Host "=== 2. Creating Milestones ===" -ForegroundColor Cyan
$milestones = Get-Content (Join-Path $ScriptDir "milestones.json") -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($ms in $milestones) {
  if ($DryRun) {
    Write-Host "[DRY-RUN] Create milestone '$($ms.title)' on $RepoSlug"
  } else {
    $existing = gh api "repos/$RepoSlug/milestones?state=all" --jq ".[] | select(.title == `"$($ms.title)`") | .number"
    if (-not $existing) {
      gh api "repos/$RepoSlug/milestones" -f title="$($ms.title)" -f description="$($ms.description)" | Out-Null
      Write-Host "  + Milestone: $($ms.title)"
    } else {
      Write-Host "  = Exists: $($ms.title) (#$existing)"
    }
  }
}

Write-Host "=== 3. Creating GitHub Project ===" -ForegroundColor Cyan
$projectNumber = $null
if ($DryRun) {
  Write-Host "[DRY-RUN] gh project create --owner $Owner --title '$ProjectTitle'"
} else {
  $existingProj = gh project list --owner $Owner --format json | ConvertFrom-Json
  $match = $existingProj.projects | Where-Object { $_.title -eq $ProjectTitle } | Select-Object -First 1
  if ($match) {
    $projectNumber = $match.number
    Write-Host "  = Existing Project #$projectNumber"
  } else {
    $createdProj = gh project create --owner $Owner --title $ProjectTitle --format json | ConvertFrom-Json
    $projectNumber = $createdProj.number
    Write-Host "  + Created Project #$projectNumber"
  }
}

Write-Host "=== 4. Creating Epics ===" -ForegroundColor Cyan
$epics = Import-Csv (Join-Path $ScriptDir "epics.csv") -Encoding UTF8
foreach ($epic in $epics) {
  if ($DryRun) {
    Write-Host "[DRY-RUN] gh issue create --repo $RepoSlug --title '$($epic.Title)' --milestone '$($epic.Milestone)'"
  } else {
    $labelArgs = $epic.Label.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
    $url = gh issue create --repo $RepoSlug --title $epic.Title --body $epic.Body --milestone $epic.Milestone --label ($labelArgs -join ",")
    Write-Host "  + Epic: $url"
    if ($projectNumber) {
      gh project item-add $projectNumber --owner $Owner --url $url | Out-Null
    }
  }
}

Write-Host "=== 5. Creating Child Issues ===" -ForegroundColor Cyan
$issues = Import-Csv (Join-Path $ScriptDir "issues.csv") -Encoding UTF8
foreach ($issue in $issues) {
  $fullTitle = "[$($issue.ID)] $($issue.Title)"
  $fullBody = @"
**ID:** $($issue.ID)
**Parent Epic:** $($issue.Epic)
**Type:** $($issue.Type)
**Priority:** $($issue.Priority)
**Estimate:** $($issue.Estimate) pts
**Suggested Sprint:** $($issue.Sprint)
**Target Release:** $($issue.TargetRelease)
**Component:** $($issue.Component)
**Dependencies:** $($issue.Dependencies)

---

$($issue.Body)
"@
  if ($DryRun) {
    Write-Host "[DRY-RUN] gh issue create --repo $RepoSlug --title '$fullTitle' --milestone '$($issue.Milestone)'"
  } else {
    $url = gh issue create --repo $RepoSlug --title $fullTitle --body $fullBody --milestone $issue.Milestone --label $issue.Labels
    Write-Host "  + Issue: $($issue.ID) -> $url"
    if ($projectNumber) {
      gh project item-add $projectNumber --owner $Owner --url $url | Out-Null
    }
  }
}

Write-Host "Bootstrap complete!" -ForegroundColor Green

