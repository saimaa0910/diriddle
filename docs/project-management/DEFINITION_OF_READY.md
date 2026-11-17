# Definition of Ready (DoR) — diriddle

A backlog item (`DIR-XXX`) is **Ready** for sprint commitment and implementation only when every criterion below is satisfied. This keeps a solo developer focused on clear, unblocked, privacy-safe increments.

---

## 1. Definition of Ready Checklist

| Gate | Requirement | Verification |
|---|---|---|
| **Ticket Structure** | Has a unique `DIR-XXX` ID, clear title, Work Type (`Epic` \| `Feature / Story` \| `Engineering Task` \| `Bug` \| `Research / Investigation` \| `Technical Debt`), Target Release, and Sprint assignment | Issue body populated from `.github/ISSUE_TEMPLATE/*` |
| **User Story & Purpose** | Business value and user outcome stated cleanly (`As a ..., I want ..., so that ...`) or clear technical rationale for engineering/infra tasks | Reviewed before moving to `Ready` |
| **Acceptance Criteria** | At least 2–4 testable `Given / When / Then` scenarios covering happy path, validation, and failure/edge cases | Unambiguous pass/fail criteria |
| **Size & Scope** | Fibonacci estimate (`1, 2, 3, 5, 8`) is **<= 8 story points** (`13` must be split into smaller deliverable slices before starting) | Fits inside a single 2-week sprint alongside solo-dev QA/release work |
| **Dependencies Unblocked** | All prerequisite `DIR-XXX` tickets, third-party accounts/keys, or schema migrations are `Done` or explicitly stubbed/mocked | Dependency links verified |
| **Contract & Schema Impact** | Impact on `packages/shared-types`, `packages/api-contracts/openapi.yaml`, `apps/api/prisma/schema.prisma`, and `CHANGE-MATRIX.md` is identified upfront | Contracts section filled out |
| **Security & Anonymity Invariants** | Privacy & security risks assessed before coding: no `users.id`/`authId`/phone/email leakage, no precise GPS persistence, server-side auth/RBAC rules specified | Security/Privacy block completed |
| **Testing Strategy Defined** | Required test layers identified (unit, real PostgreSQL integration, Supertest API e2e, mobile/admin tests, or Windows Web smoke) | Testing section filled out |

---

## 2. Solo-Developer Sizing & Split Rule

| Estimate | Typical Scope | Rule |
|---|---|---|
| **1–2 pts** | Single bug fix, copy/token tweak, small endpoint/UI fix, doc update | Ready for immediate pickup |
| **3–5 pts** | Focused feature slice (1 migration + service/controller + client screen + tests) | Ideal sprint work unit |
| **8 pts** | Multi-layer feature across API + Mobile/Admin + tests | Requires clear breakdown into technical subtasks |
| **13 pts** | Cross-cutting milestone or epic slice | **Not Ready** — must be decomposed into `<= 8` pt items first |

---

## 3. Privacy & Security Pre-Flight Gate (Mandatory for diriddle)

Before any `backend`, `mobile`, `admin`, or `database` ticket moves from `Backlog` to `Ready`, confirm:

1. **Identity Isolation**: Does the feature touch posts, comments, profiles, reports, or moderation? If yes, specify how `users.id` / `authId` / phone / email remain hidden from public DTOs and ordinary moderators (community-scoped `Anonymous #XXXX` or anonymized hashes only).
2. **Location Privacy**: Does the feature touch geolocation? If yes, specify coarse city/neighborhood or k-anonymous geo-cell storage only—never persist raw GPS coordinates (`lat`/`lng`).
3. **Error Safety**: Do client screens consume safe error codes via `userMessageForCode` without surfacing raw backend stack traces or SQL messages?
4. **Windows-First Compatibility**: If touching `apps/mobile`, `apps/api`, or `apps/admin`, note any `Platform.OS === 'web'` or `DEV_IN_MEMORY=true` behavior required for local Windows testing.
