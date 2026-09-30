# ADR-004: Core touches no I/O; every I/O crossing is a port

- Status: Accepted
- Date: Template baseline
- Related: [ADR-002](ADR-002-layered-core-and-apps-boundary.md), [ADR-003](ADR-003-core-dependency-exclusions.md), [ADR-005](ADR-005-abstractions-for-a-current-use-case.md), [ADR-008](ADR-008-postgresql-spring-jdbc-flyway.md), [ADR-015](ADR-015-archunit-nightly-ring-report.md), [ADR-016](ADR-016-one-logging-story-and-a-silent-core.md)

## Context

[ADR-003](ADR-003-core-dependency-exclusions.md) keeps drivers, frameworks and
SDKs out of `core`, but its enforcer sees only Maven coordinates. The JDK ships
everything needed to reach the outside world without a single dependency:
`java.nio.file` writes a file, `java.net` opens a socket, `Instant.now()` reads
the host clock, `UUID.randomUUID()` reads a random source. A `core` that uses any
of them passes `mvn validate` and has quietly stopped being testable without the
thing it touched.

The behaviour that needs the outside world — persisting an `Item`, stamping
`created_at`, generating an `itemId`, making two writes one decision — is
nevertheless `core`'s to decide. Only the crossing itself is infrastructure.

## Decision

**`core/src/main` opens no resource.** It references no `java.nio.file`,
`java.io.File`, `File{Input,Output}Stream`, `File{Reader,Writer}`,
`java.net.Socket`, `java.net.URL` or `java.net.http`, and holds no connection.

**Every crossing is an outbound port in `ports.<subdomain>`, implemented by an
adapter.** The template's ports are:

| Port | Question it answers | Adapter |
| --- | --- | --- |
| `ports.item.ItemRepository` | store and find items | `adapters/persistence` |
| `ports.transaction.UnitOfWork` | make several port calls one atomic decision | `adapters/persistence` |
| `ports.time.TimeSource` | what is the wall-clock instant | `adapters/jvm` |
| `ports.time.Ticker` | how much time has elapsed (monotonic) | `adapters/jvm` |
| `ports.identity.IdGenerator` | give me a new identifier | `adapters/jvm` |

**A port speaks `core`'s vocabulary.** Its signature exposes core-owned values
and never a `java.sql` type, a driver type, a file path, or a serialization
format. A port that streams bytes may name an `InputStream` an adapter opened;
the rule is about *opening* a resource whose lifecycle `core` would then own,
never about *carrying* one.

**A port reports failure without interpreting it.** What a failed write means —
retry, keep the partial result, surface a `ProblemKind` — is the flow's
decision. A uniqueness violation, for example, arrives as a
`UniqueConstraintViolation` and the flow decides that it means
`ITEM_NAME_EXISTS`.

**Non-deterministic values are crossings too.** A flow receives a `TimeSource`,
a `Ticker` or an `IdGenerator` through its constructor; it never calls
`Instant.now()`, `System.nanoTime()` or `UUID.randomUUID()`.

**Atomicity is a port, not an annotation.** A flow that needs several port calls
to be one decision takes `UnitOfWork`. It does not carry `@Transactional`, which
`core` cannot import.

The rule is checked by ArchUnit rules 3 and 8 in the nightly report
([ADR-015](ADR-015-archunit-nightly-ring-report.md)). It is not checked by
`mvn verify`.

## Rationale

These crossings are the places where an accidental import would undo
[ADR-003](ADR-003-core-dependency-exclusions.md) without tripping it. Naming each
one as a port makes the boundary something a reviewer can point to rather than a
habit.

The distinction the rule draws is *call site versus collaborator*, not
JDK-versus-third-party. `Instant.now()` is invisible in a signature and cannot be
substituted; a `TimeSource` passed to a constructor is visible, substitutable,
and is what makes the flow testable with a fixed instant. That is why the rule
forbids the call and not the concept, and why `adapters/jvm` may hold
`Instant::now` without contradiction.

Time is two ports rather than one because the two readings have different
correctness requirements: a wall clock may jump, and a duration measured across a
jump is wrong. Naming them separately means an implementation cannot satisfy one
contract by accident while breaking the other. `TimeSource` is not called `Clock`
because `java.time.Clock` already exists; two types with one name is a cost with
no benefit.

The implementations of the time and identity ports get a module of their own,
`adapters/jvm`, because the external system they adapt is the host JVM — as
nameable a boundary as a database — and naming it is what stops the module
becoming the place any homeless implementation lands.

A port that reports failure without interpreting it keeps the adapter
replaceable. If the adapter decided what a failure means, a second adapter would
have to reproduce that decision exactly, and the rule would live in two places.

None of this is speculative abstraction under
[ADR-005](ADR-005-abstractions-for-a-current-use-case.md). A port with one
adapter exists because the boundary requires it, not because a second adapter is
expected.

## Alternatives considered

### Return JDBC types (`ResultSet`, `java.sql.Timestamp`) from a port — rejected

Zero mapping code and a familiar shape. Rejected because it puts `java.sql` in
`core`'s API surface, ties the domain to JDBC before a non-JDBC store is ruled
out, and makes the port impossible to fake without a driver.

### One combined adapter port for everything an adapter does — rejected

Fewer interfaces, one thing for an adapter to implement. Rejected because the
crossings are not one concern: time and identity have nothing to do with the
database, and binding them to the persistence adapter would force every future
storage adapter to reimplement them.

### Let `core` write files or JSON directly — rejected

Simplest where the data is `core`'s own model. Rejected because it needs a
serialization library, which [ADR-003](ADR-003-core-dependency-exclusions.md)
fails the build for, and because where data lands is an operational decision,
not a domain one.

### One `TimeProvider` for time, elapsed time and identifiers — rejected

Fewer types, one seam to wire. Rejected because a single type that answers "what
time is it", "how long did that take" and "give me an id" is a utility, and the
three needs have different contracts; folding them together invites an
implementation that is correct for one caller and silently wrong for another.

### A `TimeSource.system()` default inside the port — rejected

The cheapest wiring: no adapter and no constructor change where a caller does
not care. Rejected because it places `Instant.now()` inside `ports`, violating
the rule it exists to make checkable.

### `@Transactional` on flows — rejected

The idiomatic Spring answer. Rejected because it requires Spring in `core`, and
because an annotation hides the transaction boundary from a reader of the flow
where a `UnitOfWork` call shows it.

## Consequences

### Positive

- `core` is testable with in-memory fakes for every port, with a fixed clock and
  predictable identifiers.
- A second implementation of any port — another database, an object store — is
  an additional adapter, not a change to the domain.
- Every crossing between domain behaviour and infrastructure has a name, a
  signature, and one adapter module that owns it.

### Negative

- **Enforcement is a report, not a gate.** The enforcer cannot see JDK packages,
  and the ArchUnit rules that can run nightly and block no pull request. A
  violation can land and be found the next morning.
- More interfaces for each adapter to implement raises the cost of adding one.
- A port's parameter object accretes shape as use cases arrive. That accretion
  needs watching: it is the natural place for a query language to appear by
  accident.
- Resource ownership across a port is manual. A caller that leaks a stream an
  adapter opened leaks whatever the adapter holds, and the type system does not
  prevent it.
- The rule forbids opening a resource, not naming one: `InputStream` and
  `IOException` in a port signature are allowed. A reader must understand that
  distinction to apply the rule correctly.
