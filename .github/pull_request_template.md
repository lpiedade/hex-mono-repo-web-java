<!--
  Title: a Conventional Commit subject, imperative, ≤ 72 chars
  (feat: / fix: / chore: / docs: / refactor: / test:).
  No attribution trailer or "Generated with" footer in this description.
  Merged with a merge commit, never squash or rebase (ADR-018).
  Delete these comments.
-->

## What and why

<!-- What the change does and why, in a few sentences. The diff shows the how. -->

Closes #NN

## Acceptance criteria covered

<!-- The issue's criteria this PR satisfies, with their IDs. Name any left for a follow-up. -->
- [x] <criterion> (FR-001, AC-001)

## Decisions

<!-- ADRs followed, amended or added. A change to something an ADR covers updates the ADR in this PR. -->
- ADR-0NN —

## Verification

- [ ] `mvn clean verify` — green, no skipped suite (ADR-006)
- [ ] `npm run test:coverage && npm run build` in `portal/web` (if the SPA changed)
- [ ] `npm run test:a11y` in `portal/web` (if a screen changed)
- [ ] `mvn -Parchitecture verify` (if `core` packages moved or gained dependencies — ADR-015)

## Checklist

- [ ] Contract changed first and code regenerated from it (`openapi-v1.yaml`, `portal-api-v1.yaml` — ADR-012)
- [ ] Schema changes are a new `V<n>__*.sql`; no shipped migration edited (ADR-021)
- [ ] No coverage floor lowered; a raised floor is recorded in `docs/performance/coverage-ratchet.md` (ADR-019)
- [ ] `core` still has no framework, driver, I/O or logging dependency (ADR-003, ADR-004, ADR-016)
- [ ] User-facing text goes through i18n in every bundle (`portal/CLAUDE.md`)
- [ ] No secret, token or real personal data committed
