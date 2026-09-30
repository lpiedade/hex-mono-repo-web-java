# Functional Specifications

This directory holds the version-controlled functional specifications of App.

A functional specification defines what the product must do: the observable
behaviour its users and callers can rely on, and the acceptance evidence required
before a capability counts as complete. It says nothing about *how* the code is
arranged — that is [`../arch/`](../arch/) — and it records no design decision
with alternatives — that is [`../adr/`](../adr/).

| Question | Home |
| --- | --- |
| What must the product do, and how is it proven? | `docs/spec/` (this directory) |
| How is the system arranged? | [`docs/arch/`](../arch/) |
| Why was it decided this way, and what was rejected? | [`docs/adr/`](../adr/) |
| How much is a feature worth? Is it delivered? | [feature register](../plans/feature-register.md) |
| What is worked next? | [implementation plan](../plans/implementation-plan.md) |

Start a new specification by copying [`FS-000-template.md`](FS-000-template.md).

## Naming

One file per capability, with a sequential identifier and a short kebab-case
title:

```text
FS-0XX-short-capability-title.md      e.g. FS-001-item-catalogue.md
```

Identifiers are never reused. `FS-000` is reserved for the template.

## Identifiers inside a specification

| Identifier | Meaning | Numbering |
| --- | --- | --- |
| `FR-###` | A functional requirement: one testable obligation, stated as "The system shall ..." | Per specification, from `FR-001`, contiguous |
| `SEC-###` | A security requirement | Per specification, from `SEC-001` |
| `AC-###` | An acceptance criterion: a Given/When/Then scenario that proves one or more requirements | Per specification, from `AC-001` |
| `FS-0XX-F##` | A feature — a deliverable slice of the specification's **In scope** list | Assigned in the [feature register](../plans/feature-register.md), not here |

Because numbering restarts in every specification, a requirement is cited with
its specification when there is any doubt: `FS-003 FR-012`. Group requirements
into sections by functional area, and keep each section's range contiguous so an
issue can cite `FR-010..FR-018` and mean exactly that section.

Rules that keep the identifiers trustworthy:

- **An identifier is never renumbered and never reused.** A withdrawn
  requirement keeps its heading, marked *withdrawn*, with a one-line note saying
  why.
- **Every requirement is covered by at least one acceptance criterion**, or the
  traceability table says why not (a negative requirement, a deferred one).
- **Never cite an identifier that does not exist.** An issue, commit or ADR that
  cites `FR-###` must be able to link to it.

## Priority: MoSCoW tiers

A specification states obligations; it does not rank them. Priority is a
property of the *feature*, recorded in the
[feature register](../plans/feature-register.md) with one of four tiers:

| Tier | Meaning | Issue label |
| --- | --- | --- |
| Must | The product is not deliverable without it | `must` |
| Should | Materially degraded without it, but a fallback exists | `should` |
| Could | Real value, nothing promised depends on it | `could` |
| Won't | A deliberate product boundary | *(none — a Won't feature gets no issue)* |

A tier says what a feature is worth, never when it ships; ordering is the
[implementation plan](../plans/implementation-plan.md)'s. When a specification
wants to register something it deliberately does not require, it names it under
**Out of scope** or **Future capabilities**, and the register may carry it as a
Won't row.

## Status

| Status | Meaning |
| --- | --- |
| `Draft` | Incomplete and still being explored |
| `Proposed` | Complete enough for review. Authorizes no implementation |
| `Approved` | The implementation and acceptance contract |
| `Deprecated` | No longer applicable |
| `Superseded` | Replaced by another specification, which is named |

**`Approved` is not a delivery claim.** It says the specification is the
contract, not that the contract is met. Whether a feature is delivered is the
feature register's fact, and only its.

## Amending an approved specification

An approved specification still changes. Rewrite the requirement in place, mark
its heading `*(amended — <source>)*`, where the source is the ADR, issue or
review that caused the change, and add an italic note below it recording what it
used to say and why it changed. Nothing is amended without such a note, so the
current text is always the contract and the history is always one read away.

## Definition of Done

Each specification ends with a **Definition of Done** that lists what must be
true before the capability is complete. At a minimum:

- every acceptance criterion has reproducible evidence — an automated test that
  runs in `mvn clean verify` (or the portal's test run), never a skipped one;
- the contracts in [`../arch/api-layer/`](../arch/api-layer/) and the
  specification agree;
- the ADRs the capability requires are `Accepted`;
- the feature register rows for the specification carry their result and
  evidence.

A specification adds items of its own (a security scan, an accessibility check,
a manual walkthrough) when the capability needs them.

## Specifications

| ID | Title | Status |
| --- | --- | --- |
| [FS-000](FS-000-template.md) | Template — copy it to start a specification | — |
