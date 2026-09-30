# Implementation Plan

- Status: Live
- Last reviewed: YYYY-MM-DD
- Scope: what to work on next, and in what order, across every release

This document owns **ordering** and nothing else. It does not record whether an
issue is open, what a specification requires, how important a feature is, or
whether it is delivered — each of those has exactly one other home, listed in §1.
A document that restates a fact it does not own cannot stay true.

## 1. Where each fact lives

| Fact | Home |
| --- | --- |
| Obligation — `FR` / `SEC` / `AC` | [`docs/spec/`](../spec/) |
| Priority — Must / Should / Could / Won't | [`feature-register.md`](feature-register.md) |
| Result — delivered, with evidence | [`feature-register.md`](feature-register.md) |
| State — open, closed, blocked, pickable | GitHub issues |
| **Ordering — what to do next** | **this file** |

## 2. How to use this, and how to keep it true

**Pick a whole wave, not an issue.** A wave is an execution batch: issues that
share a surface, sized so one person or agent reads that surface once and fixes
several things in it. Working a wave produces a stack of pull requests off one
worktree, which is why
[ADR-018](../adr/ADR-018-merge-commits-not-squash.md) forbids squash merges.
Record the modules a wave touches before starting, so two people do not take
overlapping waves into parallel worktrees.

**Verify before you start, and fix this file in your first commit.** Check that
the issues in your wave are still open and unblocked (`gh issue view`), and if
this document is wrong, correct it as part of the work. The reader is the
maintainer, because the reader has already paid the cost of looking.

**Pickability is not priority.** `label:ready-for-agent -label:blocked` answers
*what may be worked*; this file answers *what should be worked next*.

## 3. The ordering rule

**An item that makes an already-shipped claim true outranks an item that adds
capability.** The first is a correctness debt already in a user's hands; the
second is not yet promised. Cost breaks ties.

Priority does not decide order on its own: a Must-tier feature may sit in a late
wave because something it needs lands first, and a Could-tier fix may run early
because it is cheap and unblocks others.

## 4. The waves

<!--
One subsection per wave, in the order they should be worked. Mark a finished
wave "✓ complete" and keep its items only while they explain why the surface
was the way it was; otherwise delete it.
-->

### Wave A — <name>

*Surface: <modules and packages the wave touches, e.g. `core` `item` rings,
`adapters/persistence`, `apps/api`, `portal/web` item screens>.*

<One paragraph: why this wave, and why now.>

- [ ] #NN — <issue title> (FS-0XX-F##)
- [ ] #NN — <issue title> (FS-0XX-F##)

### Wave B — <name>

*Surface: <...>.*

- [ ] #NN — <issue title>

## 5. Ordering constraints that are real

Everything above can be reordered. These cannot:

- <#NN before #MM — why: e.g. the migration precedes every consumer; a ratchet
  cannot precede the measurement it ratchets.>

## 6. What this document does not do

- It does not record a result, or any issue's state. Those are the feature
  register's and GitHub's.
- It does not classify a feature. That is the feature register's.
- It does not add a requirement. Every item traces to a specification
  obligation, an unmet result in the register, or a defect in the tree.
- It does not schedule the Won't tier. A Won't feature has no issue, which is
  what makes it a Won't.
