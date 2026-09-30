# ADR-015: ArchUnit reports on the rings nightly, and does not gate the build

- Status: Accepted
- Date: Template baseline
- Related: ADR-002, ADR-003, ADR-004, ADR-016, ADR-019

## Context

[ADR-002](ADR-002-layered-core-and-apps-boundary.md) divides `core` into three
package rings — `domain`, `flows`, `ports` — with dependencies running
`flows → ports → domain`, and each ring subdivided by subdomain. It prices the
strongest enforcement of that direction, one Maven module per ring, and declines
it as disproportionate. That leaves the rings as a package convention:
[ADR-003](ADR-003-core-dependency-exclusions.md)'s enforcer sees dependencies,
not packages, so nothing in `mvn clean verify` stops `domain` importing `flows`.

Several other invariants stated in prose have the same property. "Every crossing
out of the domain is a named port" ([ADR-002](ADR-002-layered-core-and-apps-boundary.md))
and "`core` touches no I/O" ([ADR-004](ADR-004-core-touches-no-io.md)) are
easy to break with a single JDK call — `Files.write`, `Instant.now()`,
`UUID.randomUUID()` — that no dependency rule can see, because the offending
type ships with the JDK. A defect of that kind compiles, passes its tests, and
is discovered only when someone reads the package.

ArchUnit is the obvious instrument, and there is a standing objection to it
that this record accepts rather than disputes: **an ArchUnit rule is test code.**
It can be deleted, disabled or excluded from a run, and a violation surfaces as
a failing test someone can mark as ignored. A Maven dependency edge cannot be
violated without editing a POM, which is a visible, reviewable change. Where a
boundary can be a POM edge, it should be one.

## Decision

**ArchUnit is an instrument, not a gate.** It runs nightly, reports, and goes
red on a new violation. It never blocks a pull request, and `mvn clean verify`
does not run it.

- The rules live in `ArchitectureTest`, in `core/src/test`, next to their
  subject, driven by a plain `ClassFileImporter` rather than the JUnit engine.
- Surefire excludes them by default. The `architecture` profile clears the
  exclusion with the `<excludes combine.self="override"/>` idiom, so
  `mvn -Parchitecture verify` runs them.
- `.github/workflows/architecture.yaml` runs that profile on a nightly schedule
  and on manual dispatch, publishes the report to the job summary and as an
  artifact, and fails the run on a violation that is not frozen.
- A self-test in `ArchitectureTest` proves each rule fires against planted
  fixtures beside it. A rule that cannot be shown to fail is not added.

**Jurisdiction is split with no overlap. A ring is ArchUnit's; a layer is the
enforcer's and the POM's.** ArchUnit states nothing about module dependencies,
because every such statement is unfalsifiable here: `core` declares no
intra-repository dependency and each adapter declares only `core`, so the
forbidden edge cannot be written without a POM change, which ADR-003's enforcer
and the reactor already own.

### The rules

| # | Rule | Source |
| --- | --- | --- |
| 1 | `domain` depends on neither `flows` nor `ports` | ADR-002 |
| 2 | `ports` does not depend on `flows` | ADR-002 |
| 3 | `core` opens no resource — no file, socket or URL | ADR-004 |
| 4 | Each ring's subdomain slices are free of cycles | ADR-002 |
| 5 | `ports` holds only a port, a port DTO or a port failure | ADR-002 |
| 6 | Every class in a ring lives in a subdomain package | ADR-002 |
| 8 | `core` reads no clock and invents no identifier or random value | ADR-002, ADR-004 |

The exact API lists belong to `ArchitectureTest`, not to this record, so the
two cannot drift.

**Rule 7 is absent by design.** That `core` carries no logging API, and the
check that enforces it, belong to
[ADR-016](ADR-016-one-logging-story-and-a-silent-core.md), which gates it in
`mvn validate` for reasons it gives. The number is left as a gap so the set is
never renumbered.

**Rule 3 is narrow on purpose.** It forbids *opening* a resource whose
lifecycle `core` would then own, never *carrying* one an adapter opened.
`InputStream`, `IOException` and `StandardCharsets` stay permitted in `ports`: a
port that streams bytes must name a stream in its signature, which is ADR-004
working. JDK constants such as `java.sql.Types` stay permitted too; ADR-003 bans
drivers by coordinate.

### Three ports for non-deterministic values

Rule 8 forbids the call, not the concept, so `core` needs somewhere to get time
and identity from. Three ports answer three different questions:

- `ports.time.TimeSource` — a wall-clock instant.
- `ports.time.Ticker` — elapsed time, which wants a monotonic reading and not a
  clock.
- `ports.identity.IdGenerator` — a generated identifier, for which the JDK
  offers no abstraction at all.

`TimeSource` is not called `Clock` because `java.time.Clock` already exists; two
types named `Clock`, one ours and one the JDK's, is a cost with no benefit. They
live in two subdomains rather than one catch-all, because a package that says
only "miscellaneous" accretes the way `common` and `util` do.

Their implementations live in **`adapters/jvm`**, over the JVM clock,
`System.nanoTime` and `UUID`. The external system those three adapt is the host
JVM, which is as nameable a boundary as a database, and naming it that way is
what stops the module becoming the place any homeless implementation lands.

### Freezing, and an empty store

`FreezingArchRule` can record known violations in `core/archunit_store/`,
committed to the repository, so the nightly reports only what is new. **In the
template the store is empty and every rule is green.** Store creation stays
disabled by default (`core/src/test/resources/archunit.properties`), so a
baseline can only be produced deliberately by a person and arrives as a
committed diff; re-baselining with `-Darchunit.freeze.refreeze=true` is the same.
Store updates stay enabled, so a local run that finds a frozen violation gone
rewrites the store to drop it — the store can shrink on its own, never grow.

Class resolution is narrowed to `com.example.app` via
`SelectedClassResolverFromClasspath`. Resolving every missing class from the
classpath is ArchUnit's default and a documented order-of-magnitude cost;
disabling resolution altogether degrades exactly what rules 1, 2, 5 and 6
depend on, which is the type hierarchy of the project's own packages.

## Rationale

A nightly report is not offered *instead of* a POM edge, because inside `core`
there is no POM edge to offer it instead of — ADR-002 rejected the module split,
and this record does not reopen that. It is offered instead of nothing.

Reporting rather than gating keeps the failure mode honest. A rule that blocks a
pull request creates pressure to disable it, which is precisely the decay the
objection above predicts; a rule that reports creates pressure to ignore it,
which is cheaper to survive and visible in the same place every night.

Keeping a green rule green is cheap; discovering long after the fact that it
stopped being green is not. A file write inside the domain, or a clock read
inside a flow, is exactly the kind of defect nothing in a package name argues
against, and it is the kind this instrument catches on the night it lands.

`java.time.Clock` being acceptable in an adapter while `Instant.now()` is not
acceptable in `core` may look inconsistent. The distinction is *call site versus
collaborator*. `Instant.now()` is invisible in a signature and cannot be
substituted; a `TimeSource` passed to a constructor is visible, substitutable,
and is what makes the behaviour testable. That is why `adapters/jvm` may hold
`Instant::now` without contradiction.

The elapsed-time seam earns its own port because the two have different
correctness requirements: a wall clock may jump, and a duration measured across
a jump is wrong. Naming them separately means an implementation cannot satisfy
one contract by accident while breaking the other.

Restating ADR-003's banned dependency families as ArchUnit rules was considered
and dropped for the same reason the layer axis was: in `core` those rules cannot
fail. A rule that cannot fail is worse than an absent one, because it reads as
coverage.

## Alternatives considered

### Make ArchUnit a build gate in `mvn verify` — rejected

The strongest enforcement available, and what most projects do. Rejected on the
objection in the context: a rule in test code can be deleted, disabled or
excluded, and a gate is what makes deleting it worth someone's while. A gate
would also change the contract of `mvn clean verify`, which every contributor
runs, in exchange for an instrument whose first purpose is discovery.

### One Maven module per ring under `core/` — rejected

Would make `flows → ports → domain` a compile error rather than a report, which
is strictly stronger. ADR-002 rejected it as disproportionate — three POMs and a
slower reactor for a direction that is not being violated. Worth revisiting if
the report goes red repeatedly, or if a frozen set ever grows rather than
shrinks.

### Add Checkstyle `ImportControl` alongside — rejected

Would close ArchUnit's real blind spot: an import kept only for a Javadoc
`{@link}` leaves no trace in bytecode. Rejected because such an import is not an
architectural violation — a `{@link}` in a domain record's Javadoc documents who
consumes the type; it inverts no dependency and survives into no artifact.
Adding a second tool with a second rule file to catch it would buy source
hygiene at the cost of two places to keep aligned.

### A dedicated `arch-test` Maven module — rejected

The shape ArchUnit's community converges on for multi-module builds. Because the
layer axis is held by the enforcer, every remaining rule examines `core` alone, so
there is nothing to aggregate; the module would declare a single dependency and
add a POM, and a kind of top-level directory the layout does not describe.

### A rule that no generated contract type appears below `apps/` — rejected

It needs none. The contract models are generated inside `apps/api`, and no
module below `apps/` declares a dependency on `api`, so those types are
unreachable from `core`, the adapters and `portal/bff`. The invariant is a
missing POM edge rather than a convention, and an ArchUnit rule for it could
never fail.

### One port for all three non-deterministic values — rejected

Fewer types, one seam to wire. Rejected because a single provider that answers
"what time is it", "how long did that take" and "give me an id" is a utility,
and the three needs have different contracts; folding them together invites an
implementation that is correct for one caller and silently wrong for another.

### A `TimeSource.system()` default factory inside the port — rejected

The cheapest wiring: no adapter, no constructor change at call sites that do not
care. Rejected because it would place `Instant.now()` inside `ports`, violating
the rule the ports exist to make enforceable. Rule 8 would catch it.

## Consequences

### Positive

- The ring directions, subdomain packaging, and the "every crossing is a named
  port" principle acquire a mechanical reading without adopting the module split
  ADR-002 rejected.
- Rules that are green become regressions that cannot land unnoticed for long.
- Any architectural debt a project chooses to freeze becomes a countable,
  shrinking file, and adding to it is a reviewable diff.
- Time and identity are injectable, so flows that depend on them are testable
  without a fixed-clock workaround at the call site.

### Negative

- **It reads bytecode, so its coverage is narrower than the prose.** An import
  kept only for a Javadoc `{@link}` leaves no trace in the constant pool, and
  the report cannot see it. A green report is not proof that the rings are
  honoured everywhere.
- **Re-baselining is one argument away.** Nothing prevents a red nightly being
  answered with `-Darchunit.freeze.refreeze=true` instead of a fix, and because
  the nightly blocks nobody, that is the cheapest available response. The only
  defence is that the store is committed, so re-baselining is a diff someone
  must approve.
- **`core` gains a test-scope dependency on tooling.** `archunit` depends on
  `slf4j-api`, which is why ADR-016's logging ban is scoped to `compile` and
  `runtime`. ADR-003's enforcer searches transitively, so a future ArchUnit
  release that adds a dependency could fail `core`'s `mvn validate`.
- **The layer axis has no ArchUnit voice.** The day someone adds the POM edge
  that lets `core` see an adapter, ArchUnit will say nothing. The defence is
  review of a POM diff.
- **ArchUnit must support the toolchain's JDK.** Moving to a newer Java release
  waits on an ArchUnit release that supports it before the nightly can run.
- `adapters/jvm` joins the reactor, and the composition root depends on it, to
  hold three method references.
