---
name: Epic
about: A coarse deliverable worked through tracer-bullet child issues
title: ""
labels: ["epic"]
---

<!--
  An epic spans several deliverables and is never implemented in one pass. The
  `epic` label is the marker — no "(epic)" in the title. Add exactly one priority
  label (must | should | could) from the feature register, and ready-for-agent
  once the spec is settled enough to decompose. Delete these comments.
-->

## Parent

- Spec: FS-0XX — <title> — `docs/spec/FS-0XX-<slug>.md`
- Feature: `FS-0XX-F##` — <feature name> (see feature register — `docs/plans/feature-register.md`)

## What to build

<!-- One short paragraph on the capability the whole epic delivers. -->

## Normative coverage (FR / AC)

- FS-0XX: FR-001 – FR-0NN; AC-001 – AC-0NN

## Decomposition

<!--
  The tracer bullets, each a ready-for-agent implementation issue that is picked
  and closed on its own. The epic closes when this list is done. If it is empty,
  producing it is the first piece of work.
-->
- [ ] #NN — <thin end-to-end slice>
- [ ] #NN — <next slice>

## Prerequisite ADRs

- ADR-0NN — <title> — `docs/adr/ADR-0NN-<slug>.md`

## Blocked by

<!-- Closable issue references only; delete the section if none. -->
- [ ] #NN — <title>

## Out of scope

- `FS-0XX-F##` — <feature> (Could)
