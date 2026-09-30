# ADR-019: Coverage is a per-module ratchet, not a target

- Status: Accepted
- Date: Template baseline
- Related: ADR-006, ADR-015, ADR-017

## Context

Without a measurement of the tested surface, no change can be shown to improve
or degrade it, and "the suite passed" is the only evidence a result can carry.
Measuring is cheap — JaCoCo for the Maven modules, Vitest's coverage provider
for `portal/web`. Deciding what the measurement is *for* is the harder part.

The usual answer, an absolute target, turns the baseline into a negotiation: a
number nobody measured, argued for rather than observed. The question this
record answers is what shape an enforcement can take that a measurement
actually supports, and why coverage earns a build failure when
[ADR-015](ADR-015-archunit-nightly-ring-report.md) decided the architecture
rules do not.

## Decision

**A per-module ratchet: a floor at or below the last recorded measurement, and
never above it.** It answers exactly one question — *did this change reduce what
the tests reach?* — per module, against a figure that was observed rather than
argued for.

- **Floors live beside their module.** Each Maven module's POM carries a JaCoCo
  `check` rule; `portal/web/vite.config.ts` carries the Vitest thresholds. They
  gate `mvn clean verify` and `npm run test:coverage` respectively.
- **The floors and the procedure are recorded in
  `docs/performance/coverage-ratchet.md`**, one row per module and counter.
- **The template ships measured floors.** Every floor is the reading taken on
  the template itself, with only the example aggregate `items`, so the ratchet
  holds from a new project's first commit. Replacing `items` with real code
  moves the figures, and that move is recorded like any other.
- **Both counters carry a floor.** Branch coverage usually trails instruction
  coverage, most sharply in adapters, whose error paths are the hardest to
  reach. A floor on instructions alone lets those paths erode untouched.
- **`BUNDLE` granularity.** The question is about the module. A per-class floor
  fails a build for adding a thin class that is obvious by inspection, while
  saying nothing about whether the module got worse.
- **The merged unit-and-integration execution data.** Much of the testing here
  is integration tests ([ADR-006](ADR-006-testcontainers-for-integration-tests.md));
  unit data alone would understate every adapter and `apps/api`.
- **`portal/web` is held separately.** The SPA is a standalone build
  ([ADR-017](ADR-017-static-spa-without-a-reverse-proxy.md)), so Maven cannot hold it,
  and the two toolchains are never averaged, because an average of two
  instruments describes neither.

### Moving a floor

1. The floor is the last measurement **truncated, never rounded up**, at the
   precision the floor is written at. JaCoCo compares at the minimum's own
   precision, so the scale is part of the value, and truncation guarantees the
   floor sits at or below what was measured.
2. A floor is raised or lowered **only** by editing the POM (or
   `vite.config.ts`) **and** the table in `docs/performance/coverage-ratchet.md`
   in the same commit. The two never disagree, and the move is a reviewable
   diff.
3. Lowering a floor additionally requires the reason in writing, in that
   commit's body and in the table.

One exemption, and it is narrow: **`-DskipITs` does not fail the check.** That
run writes a report that understates every module, so holding a floor against
it would make the one documented unit-only command unusable.

## Why coverage gates when the ring rules do not

ADR-015 made the ArchUnit ring report an instrument that blocks no pull
request. Adopting the opposite answer here is not an inconsistency, because the
two measurements differ in three ways that decide the question:

- **A ring violation is a claim about what the structure *should* be; a coverage
  drop is a fact about the change in hand.** The ratchet never asserts that a
  module's coverage is *right* — only that this commit did not lower it.
- **The ring rules see less than their prose.** ArchUnit reads bytecode, so an
  import kept only for a Javadoc `{@link}` leaves no trace. A green report is
  not proof, and a gate that can be satisfied by moving a reference into a
  comment is worse than a report that is read.
- **Pre-existing state.** A ring rule that meets an existing violation can be
  green only through a frozen store, so gating it would gate a backlog nobody
  in the change created. A floor *is* the tree as it stands, by construction:
  the first run after it is set passes.

## Alternatives considered

### An absolute target — 70%, 80% — rejected

A number nobody measured. It fails modules that were never near it, for reasons
the change under review did not cause, and it says nothing about whether a
given change made the tested surface better or worse. A module that is small
because a capability barely exists yet would block every build that touches it.

### A reactor-wide aggregate floor — rejected

It lets one module's improvement mask another's regression, which is the
opposite of what a ratchet is for. Maven also produces no aggregate here: an
aggregate report needs a module that depends on every other, and none does.

### A nightly coverage report, on the ADR-015 model — rejected

A regression found nightly is found after the merge, when the person who caused
it has moved on. Coverage differs from the ring report in being cheap,
deterministic and attributable to one commit, so moving it into the build costs
one comparison and buys an author who sees it. ADR-015's reasoning does not
transfer.

### Self-raising floors (`autoUpdate`) — rejected

Vitest can rewrite its thresholds to the observed figure automatically. That
makes the floor a record of the last run rather than a decision, and it would
silently absorb the regression the ratchet exists to catch — a run that drops
coverage would rewrite the floor down and pass. Raising is cheap enough to do by
hand, and doing it by hand is what makes it reviewable.

### Gating on a coverage delta against the base branch — rejected

More precise in principle, and it needs infrastructure the repository does not
have: a stored baseline per branch, a way to compute it for a merge commit, and
a service to publish it, plus a second build of the base revision on every pull
request. A committed floor costs nothing and answers the same question at the
granularity that matters.

## Consequences

### Positive

- A change that lowers a module's instruction or branch coverage fails
  `mvn clean verify` (or `npm run test:coverage`), naming the module and the
  counter, before it merges.
- Every floor is an observed figure with its history in one table, so a
  reviewer can see what a module was and what the change did to it.
- No module is held to a number it was never near.

### Negative

- **The first real feature meets a high bar.** The template's floors are set by
  a small, thoroughly tested example; a new module's first code, or a real
  aggregate that replaces `items`, can legitimately land below them. Lowering a
  floor then is allowed, but it is an explicit edit with its reason recorded,
  never a flag.
- `mvn clean verify` gains a failure mode every contributor meets, which is why
  the procedure lives in `docs/performance/coverage-ratchet.md` and not only in
  the POMs.
- `-Djacoco.skip` also silences the check. It is not a sanctioned way past a
  floor; lowering one honestly is reviewable and a flag typed in a terminal is
  not. This is a social boundary, not a technical one.
- The floors drift below the tree unless raised as test work lands. That is
  accepted: a stale-low floor still catches a regression, while a stale-high one
  blocks everything. The asymmetry is deliberate, and it is also why a floor
  that no longer matches the tree is lowered honestly rather than held — a
  ratchet that fails every build becomes a flag people pass to get work done.
