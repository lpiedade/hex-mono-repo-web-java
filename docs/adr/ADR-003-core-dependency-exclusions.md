# ADR-003: Core dependency exclusions

- Status: Accepted
- Date: Template baseline
- Related: [ADR-002](ADR-002-layered-core-and-apps-boundary.md), [ADR-004](ADR-004-core-touches-no-io.md), [ADR-007](ADR-007-spring-boot-http-api-composition-root.md), [ADR-015](ADR-015-archunit-nightly-ring-report.md), [ADR-016](ADR-016-one-logging-story-and-a-silent-core.md)

## Context

`core` is the one module every other part of the system depends on, directly or
through an adapter: the persistence adapter, the JVM adapter, the HTTP API, and
any future adapter or application. Anything `core` pulls in becomes a transitive
constraint on all of them, and a permanent entry in every dependency review.

[ADR-002](ADR-002-layered-core-and-apps-boundary.md) makes `core` the centre that
adapters depend on and that depends on nothing in the reactor. That rule covers
internal modules. This record covers external ones.

## Decision

`core` declares no runtime dependencies. Its declared dependencies are test
tooling only (JUnit Jupiter, ArchUnit), at test scope.

Specifically excluded, as families:

- application frameworks — Spring and Spring Boot in any form, Jakarta CDI;
- JDBC drivers and database vendor classes;
- persistence frameworks — Flyway, Hibernate, Jakarta Persistence;
- cloud SDKs;
- orchestration and distributed-processing frameworks, and schedulers;
- Lombok;
- logging APIs and backends at compile or runtime scope
  ([ADR-016](ADR-016-one-logging-story-and-a-silent-core.md)).

This is enforced by `maven-enforcer-plugin` in `core/pom.xml`, with a
`bannedDependencies` rule and `searchTransitive` enabled. The rule binds to the
`validate` phase, so a banned dependency fails the build before compilation, and
the failure message cites this record.

## Rationale

`core`'s dependency list is inherited by every module that will ever depend on
it, so each entry is paid for many times over — in transitive CVE exposure, in
version conflicts, and in review effort. With Java records covering the
modelling need, the marginal value of a utility library is small while its cost
is permanent.

That asymmetry is why the exclusion is a hard rule rather than a case-by-case
judgement, and why it is wired into the build rather than left to review. A rule
that depends on a reviewer noticing is not a rule.

The rule also keeps `core` consumable from anywhere: a Spring Boot application, a
test with no context, or a plain `main()`. That is what lets the composition
root be a choice made in `apps/` ([ADR-007](ADR-007-spring-boot-http-api-composition-root.md))
rather than a property of the domain.

## Alternatives considered

### Allow one small utility library (Guava, Apache Commons, Lombok) — rejected

Would remove boilerplate from a model that is mostly records with validating
constructors. Rejected because records, `List.copyOf` and
`Objects.requireNonNull` already cover the need, and each library is a transitive
CVE surface inherited by every downstream module. Lombok is rejected more firmly
than the others: it is a compile-time annotation processor that changes what the
source means, which is a poor trade in code that is meant to be read.

### Allow Spring in `core` for wiring — rejected

Would let adapters be discovered and injected without hand-wiring, and would let
a flow carry `@Transactional`. Rejected because it makes `core` untestable
without an application context and unusable from a plain entry point, and
because the easiest way to wire a Spring application is to annotate the things
it wires — so the framework would spread. Atomicity across port calls is the
`UnitOfWork` port's job instead ([ADR-004](ADR-004-core-touches-no-io.md)).

### Allow `java.sql` types in the model — rejected

The argument for it is that `java.sql` is part of the JDK, not a driver, so it
costs nothing to depend on. The argument against is that it is JDBC's
vocabulary: a model that speaks JDBC is neutral only across JDBC drivers, and
its type codes can mean different things across vendors. The enforcer cannot see
a JDK package, so this is held by review and by the port rules in
[ADR-004](ADR-004-core-touches-no-io.md), not by this rule.

### An allowlist instead of a denylist — rejected

Airtight by construction. Rejected because it fails on every legitimate
test-scope addition, which was judged too costly for the value.

### Restate the banned list as ArchUnit rules — rejected

Would put every architectural rule in one place. Rejected because inside `core`
those rules cannot fail: the enforcer rejects the dependency before any class
exists to inspect. A rule that cannot fail is worse than an absent one, because
it reads as coverage. [ADR-015](ADR-015-archunit-nightly-ring-report.md) leaves
dependencies to this record.

## Consequences

### Positive

- The rule is visible in the build file rather than living only in a document.
- Adding Spring, a driver or a cloud SDK to `core` fails `mvn validate` with a
  message pointing back to this record, so the constraint survives contributors
  who have never read it.
- `core` can be consumed from a Spring Boot application, a CLI, or a plain
  `main()` with equal ease.
- Dependency review for `core` is trivial, and stays trivial as adapters grow.

### Negative

- **The ban list is a denylist, so it is incomplete by construction.** It names
  the families foreseen today. A framework nobody anticipated passes silently,
  and the list needs revisiting whenever a new kind of library enters the
  reactor.
- **Enforcement covers declared and transitive dependencies only.** It cannot
  detect a JDK package. That is why I/O ([ADR-004](ADR-004-core-touches-no-io.md))
  and logging ([ADR-016](ADR-016-one-logging-story-and-a-silent-core.md)) each
  need a check of their own.
- **Test tooling is checked transitively too.** A future ArchUnit or JUnit
  release that adds a dependency in a banned family would fail `core`'s
  `mvn validate`.
- Refusing utility libraries means validation logic is written by hand in each
  record's compact constructor. That is repetitive, and the repetition is
  visible in the model.
