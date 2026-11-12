---
name: Bug Report
about: Report a reproducible defect, regression, or privacy/security issue in diriddle
title: "BUG: DIR-XXX - "
labels: bug
---

## Bug Identification

- **Bug ID**: `DIR-XXX`
- **Title**: <!-- Short descriptive summary -->
- **Status**: `New` <!-- New | Triaged | In Progress | Ready for QA | Closed -->

## Severity

Select one:
- [ ] **Critical** — Production outage, data loss, auth bypass, or PII/anonymous-identity/location leak
- [ ] **High** — Major feature broken on primary user/admin flow with no reasonable workaround
- [ ] **Medium** — Non-blocking functional defect with a workaround or edge-case failure
- [ ] **Low** — Minor UI misalignment, copy typo, or cosmetic glitch

## Environment

Select all applicable:
- [ ] Local Windows (`DEV_IN_MEMORY=true` or Docker)
- [ ] Dev
- [ ] QA
- [ ] Staging
- [ ] Production

- **App / Service**: <!-- apps/api | apps/mobile (web/iOS/Android) | apps/admin | packages/* -->
- **Branch / Commit**: <!-- e.g. develop @ abc1234 -->

## Steps to Reproduce

1.
2.
3.

## Expected Result

<!-- What should happen according to the PRD / OpenAPI contract -->

## Actual Result

<!-- What actually happened, including HTTP status, ErrorEnvelope code, or console/stack output -->

## Privacy / Security Impact

- **Does this leak anonymous identity (`user_id` / `auth_id` / phone / email) or expose exact user location?**
  - [ ] Yes (Escalate immediately to Critical & notify `@saimaa0910`)
  - [ ] No
- **Notes**:
