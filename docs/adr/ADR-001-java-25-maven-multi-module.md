# ADR-001: Java 25 and a Maven multi-module build

- Status: Accepted
- Date: Template baseline
- Related: [ADR-002](ADR-002-layered-core-and-apps-boundary.md), [ADR-003](ADR-003-core-dependency-exclusions.md), [ADR-006](ADR-006-testcontainers-for-integration-tests.md), [ADR-015](ADR-015-archunit-nightly-ring-report.md)

## Context

The template is the starting point for long-lived backend services with a
browser front end. Two properties drive the toolchain choice.

The language runtime needs a long support horizon and a mature ecosystem —
Spring Boot, JDBC drivers, Testcontainers — because whatever is built on it will
outlive several release cadences. The build needs to produce separately
resolvable modules, because [ADR-002](ADR-002-layered-core-and-apps-boundary.md)
and [ADR-003](ADR-003-core-dependency-exclusions.md) express architectural
boundaries as build dependencies rather than as naming conventions.

## Decision

Use Java 25, with `maven.compiler.release=25` set once in the parent POM.

Use a Maven multi-module reactor under the parent artifact `app-parent`
(groupId `com.example.app`). The parent owns `dependencyManagement` — importing
the JUnit, Testcontainers and Spring Boot BOMs and pinning ArchUnit — and
`pluginManagement` for the compiler, surefire, failsafe, enforcer, JaCoCo,
Spring Boot and openapi-generator plugins. Child modules declare dependencies
and plugins without versions.

The reactor holds `core`, `adapter-persistence`, `adapter-jvm`, `api`, `portal`
and `cli`. The one validation command is `mvn clean verify`, run sequentially:
**never with `-T`**.

## Rationale

Java 25 with Maven is the lowest-risk combination that satisfies both
constraints at once: an LTS runtime with vendor-supported drivers and current
framework support, and a build system whose module graph can carry architectural
rules rather than merely describe them. Taking the newest LTS buys the longest
support runway, and moves the eventual forced upgrade years out, at the cost of
a deployment baseline that each project must still validate.

Taking Maven over Gradle trades build speed for auditability. A declarative POM
is cheaper to review than a build script, and a dependency edge in a POM is the
kind of reviewable change the boundary rules rely on.

The ban on `-T` is a property of the build, not a preference. The
openapi-generator in `apps/api` registers its output directory as a source root
during the build; under parallel execution `test-compile` can start before that
registration, producing "cannot find symbol" errors that vanish on a sequential
re-run. A flaky build that is green on retry teaches people to retry.

## Alternatives considered

### Java 21 — rejected

The previous LTS, and more widely standardised across existing enterprise
platforms. Rejected because 25 is also LTS with a longer remaining support
window, and a template has no shipped deployment that would make migration cost
real. A project whose target platform mandates 21 should revisit this record
rather than work around it.

### Java 17 — rejected

The most widely standardised LTS. Rejected because 21 and later provide record
patterns, sealed types and virtual threads, all of which the template's domain
values and error types use or can use directly, and because 17 has the shortest
remaining support window.

### Gradle — rejected

Faster incremental builds and better ergonomics for multi-module projects.
Rejected because Gradle build logic is code, which widens the surface a review
has to cover, and because the enforcement this template relies on
(`maven-enforcer-plugin`, per-module JaCoCo floors) is Maven-native.

### A single-module build — rejected

Fewer moving parts and no reactor ordering to reason about. Rejected because it
makes the boundaries in [ADR-002](ADR-002-layered-core-and-apps-boundary.md)
unenforceable by the build: with one module, nothing but review stops `core`
from importing an adapter.

## Consequences

### Positive

- Versions live in one place. BOM imports keep JUnit, Testcontainers and Spring
  versions from drifting between modules.
- `release=25` rather than `source`/`target` means the compiler rejects
  accidental use of APIs newer than the declared baseline.
- CI pins the same JDK explicitly, so local and CI compilation agree.

### Negative

- Java 25 may exceed the runtime baseline of a given deployment platform. Each
  project adopting the template must check this against its real target
  environment; it is the largest unvalidated assumption in this record.
- Tooling can lag the JDK. ArchUnit runs on JDK 25 at its supported ceiling, so
  moving the toolchain past 25 needs an ArchUnit release that supports it before
  the nightly report in [ADR-015](ADR-015-archunit-nightly-ring-report.md) can
  run again.
- Reactor ordering means a child module cannot be built in isolation without an
  installed parent or `-am`. [ADR-006](ADR-006-testcontainers-for-integration-tests.md)
  makes this stricter for modules that read shared test fixtures.
- Sequential builds are slower than parallel ones, and the `-T` ban has to be
  remembered because nothing enforces it.
