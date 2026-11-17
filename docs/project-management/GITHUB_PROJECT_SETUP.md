# GitHub Project & Repository Workflow Setup — diriddle

Repository: `https://github.com/saimaa0910/diriddle.git`  
Project Board: **`diriddle – Product Development`** (GitHub Projects v2)

---

## 1. Custom Fields (9 Required Fields)

Configure these exact fields in GitHub Project **`diriddle – Product Development`**:

| # | Field Name | Field Type | Allowed Values / Options |
|---|---|---|---|
| 1 | **Status** | Single select | `Backlog`, `Ready`, `In Progress`, `In Review`, `Testing`, `Done`, `Blocked` |
| 2 | **Priority** | Single select | `P0`, `P1`, `P2`, `P3` |
| 3 | **Estimate** | Number | Fibonacci story points: `1`, `2`, `3`, `5`, `8`, `13` |
| 4 | **Sprint** | Iteration | 2-week iterations: `Sprint 1` .. `Sprint 6` (plus `Backlog`) |
| 5 | **Epic** | Text / Single select | `DIR-EP01` .. `DIR-EP15` |
| 6 | **Work Type** | Single select | `Epic`, `Feature / Story`, `Engineering Task`, `Bug`, `Research / Investigation`, `Technical Debt` |
| 7 | **Target Release** | Single select | `Release 0.1 – Engineering Alpha`, `Release 0.2 – Feature Alpha`, `Release 0.3 – Safety Beta`, `Release 0.9 – Release Candidate`, `Release 1.0 – MVP` |
| 8 | **Due Date** | Date | Target completion date (`YYYY-MM-DD`) |
| 9 | **Component** | Single select | `backend`, `mobile`, `admin`, `database`, `security`, `devops`, `qa` |

---

## 2. Board Status Workflow (7 Columns)

| Status | Meaning & Entry / Exit Rule |
|---|---|
| **Backlog** | Triaged or future work; not yet validated against `DEFINITION_OF_READY.md` |
| **Ready** | Passes all `DEFINITION_OF_READY.md` checks (`<= 8` pts, unblocked, ACs + privacy checked) |
| **In Progress** | Active branch checked out (`feature/DIR-XXX-*` or `bugfix/DIR-XXX-*`) |
| **In Review** | PR opened against `develop` using `.github/PULL_REQUEST_TEMPLATE.md`; CI green |
| **Testing** | Merged to `develop` or staging; undergoing QA matrix, e2e, and Windows Web verification |
| **Done** | Passes all `DEFINITION_OF_DONE.md` gates and verified in target environment |
| **Blocked** | Waiting on external dependency, credential, or prerequisite `DIR-XXX` resolution (document blocker in comment) |

---

## 3. Project Views (6 Views)

Create these 6 saved views inside **`diriddle – Product Development`**:

| # | View Name | Layout | Filter | Group By | Sort |
|---|---|---|---|---|---|
| 1 | **Product Backlog** | Table | `Status:Backlog,Ready` (or `-status:Done`) | `Epic` | `Priority` asc, `Target Release` asc |
| 2 | **Current Sprint** | Board / Table | `Sprint:@current` | `Status` | `Priority` asc |
| 3 | **Development Board** | Board | `Sprint:@current` or `-status:Backlog` | `Status` (`Backlog`..`Blocked`) | `Priority` asc |
| 4 | **Bugs and Technical Debt** | Table | `Work Type:Bug,"Technical Debt"` | `Priority` | `Status` asc |
| 5 | **Roadmap** | Roadmap | All non-closed items & Epics | `Target Release` / `Epic` | Date (`Start` / `Due Date`) |
| 6 | **Release Readiness** | Table | `Target Release:@next` (or filter by active milestone) | `Status` | `Priority` asc, `Component` asc |

---

## 4. Standard Label Taxonomy

All labels defined in [`github-import/labels.csv`](./github-import/labels.csv):

### Priority Labels
- `priority:P0` (`#B60205`) — Critical / Release blocker / Security or PII risk
- `priority:P1` (`#D93F0B`) — High priority core feature or stability fix
- `priority:P2` (`#FBCA04`) — Medium priority enhancement
- `priority:P3` (`#0E8A16`) — Low priority / nice-to-have

### Work Type Labels
- `type:epic` (`#5319E7`) — Multi-sprint capability epic (`DIR-EPXX`)
- `type:story` (`#1D76DB`) — User-facing feature story
- `type:task` (`#006B75`) — Engineering or infrastructure task
- `type:bug` (`#D73A4A`) — Defect or regression
- `type:research` (`#C5DEF5`) — Spike / investigation
- `type:tech-debt` (`#BFD4F2`) — Architecture, test, or lint debt

### Component / Area Labels
- `area:backend` (`#0052CC`) — NestJS API & realtime gateway (`apps/api`)
- `area:mobile` (`#FF8A45`) — Expo mobile & Windows Web (`apps/mobile`)
- `area:admin` (`#6F42C1`) — Next.js moderation admin (`apps/admin`)
- `area:database` (`#006B75`) — Prisma, PostgreSQL, PostGIS, migrations
- `area:security` (`#B60205`) — Auth, RBAC, PII isolation, audit logs
- `area:devops` (`#0E8A16`) — Docker, CI/CD, AWS IaC, scripts
- `area:qa` (`#FBCA04`) — Jest, Supertest, PostgreSQL integration, Maestro, k6

---

## 5. Git Branching & Protection Rules

### Branch Naming Conventions
- `main` — Production releases only (tagged `vX.Y.Z`)
- `develop` — Default integration branch for active sprint PRs
- `feature/DIR-XXX-short-slug` — New stories and tasks (from `develop` -> PR to `develop`)
- `bugfix/DIR-XXX-short-slug` — Defect fixes (from `develop` -> PR to `develop`)
- `release/x.y.z` — Release candidate stabilization (from `develop` -> PR to `main` & `develop`)
- `hotfix/DIR-XXX-short-slug` — Urgent production fixes (from `main` -> PR to `main` & `develop`)

### Branch Protection Rules (Configure in GitHub Settings -> Branches)
1. **`main`**:
   - Require a pull request before merging (no direct pushes).
   - Require status checks to pass before merging (`pr-validation` / `ci`).
   - Require branches to be up to date before merging.
   - Require linear history or squash/merge commit consistency; disallow force pushes and deletions.
2. **`develop`**:
   - Require a pull request before merging (`pr-validation` checks green).
   - Disallow force pushes and deletions.

---

## 6. Importing Epics, Issues, Labels & Milestones via `gh` CLI

Because `gh` CLI must be authenticated locally with write access to `saimaa0910/diriddle`, an automated import bundle is provided under [`docs/project-management/github-import/`](./github-import/):

- [`labels.csv`](./github-import/labels.csv)
- [`milestones.json`](./github-import/milestones.json)
- [`epics.csv`](./github-import/epics.csv)
- [`issues.csv`](./github-import/issues.csv)
- [`bootstrap-github-project.ps1`](./github-import/bootstrap-github-project.ps1)

### Run on Windows PowerShell
```powershell
# 1. Install GitHub CLI (if not installed)
winget install --id GitHub.cli

# 2. Authenticate as repository owner/collaborator (saimaa0910) with project scope
gh auth login -s project,repo

# 3. Preview or run the bootstrap import from the repository root
cd C:\Users\admin\Desktop\diriddle
powershell -ExecutionPolicy Bypass -File docs/project-management/github-import/bootstrap-github-project.ps1
```
The script creates all labels, milestones, `DIR-EP01`..`DIR-EP15` epics, `DIR-XXX` backlog issues, and links them to the **`diriddle – Product Development`** GitHub Project.
