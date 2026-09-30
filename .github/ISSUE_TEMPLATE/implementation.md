---
name: Implementation issue
about: A backend, frontend or infra deliverable traced to its spec (FR / AC)
title: ""
labels: []
---

<!--
  Follows "Implementation issue conventions" in CLAUDE.md. Delete these comments.

  Labels (set by a human, see CLAUDE.md):
    - area: backend | frontend | infra
    - priority: exactly one of must | should | could — the Tier of the feature in
      docs/plans/feature-register.md, never an estimate or a schedule
    - ready-for-agent once this spec is complete enough to implement
    - never set `blocked` by hand: the workflow owns it from "Blocked by" below
  No attribution trailer or "Generated with" footer in the body.
-->

## Parent

<!-- The originating spec and/or epic, plus the feature it delivers. -->
- Spec: FS-0XX — <title> — `docs/spec/FS-0XX-<slug>.md`
- Epic: #NN
- Feature: `FS-0XX-F##` — <feature name> (see feature register — `docs/plans/feature-register.md`)

## What to build

<!-- One short paragraph on the capability, from the user's point of view. -->

## Acceptance criteria

<!--
  Group by FR area. Every bullet ends with the FR-### (and AC-###) it satisfies.
  Cite only IDs that exist in the spec. When a criterion comes from a contract
  path, an ADR or the spec's Definition of Done, cite that source instead.
-->

**<FR area>**

- [ ] <criterion> (FR-001, AC-001)
- [ ] <criterion> (FR-002)

**Contract**

- [ ] `openapi-v1.yaml` declares `<METHOD /path>` and the portal contract proxies it (ADR-012)

**Verification**

- [ ] `mvn clean verify` passes with no skipped suite (ADR-006)

## Normative coverage (FR / AC)

- FS-0XX: FR-001 – FR-00N; AC-001, AC-00N

## Prerequisite ADRs

<!-- ADRs that must be Accepted before implementation. Delete the section if none. -->
- ADR-0NN — <title> — `docs/adr/ADR-0NN-<slug>.md`

## Blocked by

<!--
  Closable issue references only, as task-list items, so GitHub tracks them and
  the `blocked` label automation can parse them. Never free text: if a whole
  domain or gate blocks this, open (or reuse) a tracking issue and cite it.
  Delete the section if there are no prerequisites.
-->
- [ ] #NN — <title>

## Out of scope

<!-- Deferred behaviour named by its ID and MoSCoW tier, so nothing is inferred. -->
- FR-0NN — <behaviour> (Should, deferred to #NN)
