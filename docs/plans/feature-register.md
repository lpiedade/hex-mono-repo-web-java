# Feature Register

- Status: Live
- Date: YYYY-MM-DD
- Scope: every release. Priority is a property of the feature, not of a release
- Method: product-absolute MoSCoW with relative effort
- Result vocabulary: `NOT_STARTED`, `IN_PROGRESS`, `PASS`, `FAIL`, `BLOCKED`

This register owns two facts and no others: **what each feature is worth** (§2)
and **whether it is delivered** (§3). Ordering lives in the
[implementation plan](implementation-plan.md); obligations live in
[`docs/spec/`](../spec/); issue state lives in GitHub.

## 1. Purpose

One classification and one result for every feature listed under **In scope**
(§2.1) of every functional specification. It changes no specification and no
acceptance contract.

It answers a product question, not a release question: which capabilities the
product cannot be delivered without, which materially degrade it by their
absence, which carry real value that nothing has promised, and which are
deliberately outside the product.

## 2. Priority

### 2.1 MoSCoW definitions

**Product-absolute, not release-relative.** A tier says what a feature is worth,
never when it ships. Ordering is the
[implementation plan](implementation-plan.md)'s, and a Must-tier feature may sit
in a late wave.

| Tier | Meaning | Issue label |
| --- | --- | --- |
| Must | The product is not deliverable without it. Its absence makes the product unusable or unacceptable. | `must` |
| Should | The product is materially degraded without it, but there is a documented fallback or reduced mode. | `should` |
| Could | Real value, not promised. Its absence degrades nothing that was promised. | `could` |
| Won't | Not on any roadmap. A deliberate product boundary, not a rejection of future value. | *(none — see below)* |

**A Won't-tier feature gets no issue.** That is what makes it a Won't: the tier
exists in this register and nowhere else, so an issue without a priority label
means "not yet prioritised" and never "Won't". There is deliberately no `wont`
label. If an issue seems to need one, the issue should not exist.

**A tier can be reversed, and the reversal is a diff here.** Nothing else records
a tier, so moving one is a one-line change in this file (with a note in §7 saying
why) and, for a feature leaving Won't, a new issue.

**Every implementation issue carries exactly one priority label**, taken from the
tier of the feature it delivers — never from an estimate, and never from how soon
the work is scheduled.

### 2.2 Effort

Relative, and not a delivery estimate. It exists to size an execution wave.

| Size | Weight | Meaning |
| --- | ---: | --- |
| S | 1 | Localized change with low integration risk |
| M | 3 | Several components or a meaningful contract change |
| L | 5 | Cross-module behaviour with integration and acceptance work |
| XL | 8 | Broad vertical slice, new subsystem, or high uncertainty |

No person-days, dates or velocity are inferred from these weights.

### 2.3 Category key

Short codes grouping features by surface. Define your own:

`<CAT>` <meaning> · `QA` quality and packaging

## 3. Result

### 3.1 Vocabulary

| Result | Meaning |
| --- | --- |
| `PASS` | Every obligation the feature owns is met, with reproducible evidence and no skipped required test |
| `IN_PROGRESS` | Merged deliverables exist; at least one owned obligation is unmet. **Authorizes no claim that `NOT_STARTED` would not** |
| `NOT_STARTED` | No merged deliverable |
| `FAIL` | Evidence exists and contradicts the obligation |
| `BLOCKED` | Cannot proceed until a named prerequisite lands |
| `—` | Won't tier. Not a result; the feature is outside the product |

### 3.2 Verification method

A result is recorded from two sources, both reproducible, and **never from an
issue's closed state**:

- the `Build` workflow on the pull request that merged the work, running
  `mvn clean verify` against a Docker-compatible runtime; and
- a direct read of the merged tree, confirming the behaviour the acceptance
  criteria describe actually landed.

A merged pull request is not a passing build, and a test profile no workflow runs
produces no evidence.

## 4. Completion and claims

**The product is deliverable when every Must-tier feature reads `PASS`.** A
specification is *partially delivered* while any feature it owns is below
`PASS`, and `IN_PROGRESS` counts exactly as `NOT_STARTED` for any claim.

## 5. The register

Feature IDs are `FS-0XX-F##`: the owning specification plus a two-digit number,
from `F01`, never reused. `Covers` lists the `FR`, `SEC` and `AC` identifiers the
feature owns; an identifier constraining two features is cited by both. Every
identifier in a specification is owned by at least one feature. `vehicle` marks a
feature that describes *how* acceptance is proven rather than a capability.

### 5.1 FS-0XX — <Specification title>

FR-001..FR-0NN · SEC-001..SEC-0NN · AC-001..AC-0NN

| Feature | Cat | Tier | Eff | Covers | Result | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| **F01** <feature, as a noun phrase> | <CAT> | Must | M | FR-001..FR-003 · AC-001 | NOT_STARTED | |
| **F02** <feature> | <CAT> | Should | S | FR-004 · AC-002 | NOT_STARTED | |
| **F03** <feature deliberately outside the product> | <CAT> | Won't | — | — | — | |

## 6. Product boundaries

What the product does not contain and makes no claim for, beyond the Won't rows
above. Listed only to prevent accidental scope expansion.

- <boundary>

## 7. Tier changes

| Date | Feature | From | To | Why |
| --- | --- | --- | --- | --- |
