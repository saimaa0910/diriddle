# QA Process — diriddle (Stage 06)

This document defines the Stage 06 QA verification workflow, functional test matrix, bug severity triage, and exit criteria.

## Stage 06: 8-Step QA Testing Sequence

1. **Verify Build & Environment Readiness**: Confirm PR is merged to `develop` (or `release/*`) and CI (`pr-validation.yml`) is green.
2. **Launch Target Environment**: Start Windows test stack (`pnpm run test:windows`) or connect to QA/Staging environment (`api`, `mobile` web/native, `admin`).
3. **Smoke Test Core Services**: Verify `GET /v1/health` (`200 OK`), Swagger `/docs-json`, Expo Web (`http://localhost:8081`), and Admin (`http://localhost:3001`).
4. **Execute Auth & Onboarding Flow**: Test OTP send/verify (`123456` in dev/in-memory), 18+ age eligibility gate, and Indian city selection.
5. **Execute Feature Test Cases**: Run the feature-specific test matrix (e.g., `QA-001`–`QA-010` below for Anonymous Post Creation).
6. **Verify Moderation, Safety & Privacy Invariants**: Test PII/keyword auto-moderation, reporting, user blocking, and confirm zero PII/`userId` leakage in API responses.
7. **Verify Admin Dashboard Workflows**: Confirm reports queue, moderation actions (Approve/Remove/Warn/Suspend), and immutable `AuditLog` entries update accurately.
8. **Log Defects & Sign Off**: File bugs using `.github/ISSUE_TEMPLATE/bug-report.md` and record final QA decision.

---

## Feature Test Matrix: Anonymous Post Creation (`QA-001` – `QA-010`)

| Test ID | Scenario | Preconditions / Input | Expected Outcome |
|---|---|---|---|
| **QA-001** | Valid anonymous post creation | Authenticated 18+ user joined city community; valid `community_id`, `category=CONFESSION`, 50-char `content` | `201 Created`; returns `PostDto` with `anonymous_name` (`Anonymous #XXXX`), `status=PUBLISHED`; `userId` absent from payload |
| **QA-002** | Consistent per-community identity | Same user creates 2nd post in same community | Both posts display the identical `Anonymous #XXXX` code |
| **QA-003** | Isolated cross-community identity | Same user posts in a different community (e.g. Mumbai vs Bengaluru) | Assigned a distinct `Anonymous #YYYY` code scoped to the 2nd community |
| **QA-004** | Empty or whitespace-only content | `content: "   "` | `400 Bad Request` (`ErrorEnvelope`); post not created |
| **QA-005** | Exceeding max post length | `content` length `2001` chars (> 2000 limit) | `400 Bad Request` (`ErrorEnvelope`); mobile composer enforces 2000-char limit |
| **QA-006** | Invalid post category | `category: "INVALID_CAT"` | `400 Bad Request` (`ErrorEnvelope`) |
| **QA-007** | Unauthenticated post attempt | Missing or expired Bearer JWT | `401 Unauthorized` (`ErrorEnvelope`) |
| **QA-008** | PII / doxxing auto-moderation trigger | Content contains Indian phone number or Aadhaar-like PII pattern | Flagged/held (`UNDER_REVIEW`) or rejected per moderation policy; report/queue entry visible in Admin |
| **QA-009** | Idempotent duplicate submission | Same `idempotency_key` sent twice within window | Returns original post without creating duplicate feed item |
| **QA-010** | Real-time feed & delete own post | Post created -> visible in `/v1/feed/latest` & Socket.IO `post:created`; owner calls `DELETE /v1/posts/:id` | `204 No Content`; post removed from feed; another user attempting delete receives `403 Forbidden` |

---

## Bug Management & Severity Classification

| Severity | Definition | SLA / Release Impact |
|---|---|---|
| **Critical** | Auth bypass, PII / anonymous identity / exact location leak, data corruption, or service crash | **Immediate Blocker** — halts QA/release; hotfix required before merge |
| **High** | Core user or moderation workflow broken with no workaround | **Release Blocker** — must be fixed and re-verified before RC sign-off |
| **Medium** | Functional issue with an acceptable workaround or rare edge case | Scheduled for current sprint if capacity allows, otherwise next sprint |
| **Low** | Minor visual spacing, copy, or non-critical UX polish | Logged to backlog; does not block release |

---

## QA Decisions & Exit Criteria

- **PASS**:
  - 100% of `Critical` and `High` test cases pass
  - Zero open `Critical` or `High` defects
  - Privacy/anonymity checks (`QA-001`–`QA-003`, `QA-008`) verified with zero PII leakage
  - Automated unit (`pnpm run test`) and API e2e (`pnpm run test:e2e`) suites pass
- **PASS WITH CONDITIONS**:
  - Only `Medium`/`Low` known issues remain, documented with approved workarounds and target fix ticket IDs
- **FAIL / REJECTED**:
  - Any `Critical` or `High` bug open, core flow broken, or automated gates failing
