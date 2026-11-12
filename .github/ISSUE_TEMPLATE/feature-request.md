---
name: Feature Request
about: Propose a new feature, enhancement, or workflow improvement for diriddle
title: "FEAT: DIR-XXX - "
labels: enhancement
---

## Task Metadata

- **Task ID**: `DIR-XXX`
- **Priority**: <!-- P0 (Blocker/Launch) | P1 (High) | P2 (Normal) -->

## User Story

> As a **[anonymous user / community member / moderator / admin]**,
> I want **[capability]**,
> so that **[value / outcome]**.

## Acceptance Criteria

- [ ] Criteria 1
- [ ] Criteria 2
- [ ] Criteria 3

## API Contract & Database Impact

- **OpenAPI Spec (`packages/api-contracts/openapi.yaml`)**: <!-- New/modified endpoints or "None" -->
- **Shared Types (`packages/shared-types/src/index.ts`)**: <!-- New/modified enums/DTOs or "None" -->
- **Database Schema (`apps/api/prisma/schema.prisma`)**: <!-- Migration needed? Backward-compatible? -->

## Privacy & Moderation Considerations

- **Anonymous Identity**: Does this preserve per-community `Anonymous #XXXX` scoping without exposing `user_id` or PII?
- **Location Privacy**: Does this keep location coarse (city / neighborhood / k-anonymity threshold) without storing raw GPS?
- **Moderation & Abuse**: What rate limits, PII filters, or report/block controls apply?
