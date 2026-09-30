# ADR-006: Testcontainers for integration tests, and no skipped suites

- Status: Accepted
- Date: Template baseline
- Related: [ADR-001](ADR-001-java-25-maven-multi-module.md), [ADR-002](ADR-002-layered-core-and-apps-boundary.md), [ADR-008](ADR-008-postgresql-spring-jdbc-flyway.md), [ADR-014](ADR-014-real-service-browser-acceptance.md), [ADR-021](ADR-021-one-migration-stream-and-one-baseline.md)

## Context

The persistence adapter's job is SQL against PostgreSQL, run through Flyway
migrations ([ADR-008](ADR-008-postgresql-spring-jdbc-flyway.md)). The HTTP API's
integration suites drive the application end to end over real HTTP, which means
a real schema behind it. Neither can be tested honestly against anything that is
not the database the product runs on.

At the same time `core` must be testable with no database at all
([ADR-002](ADR-002-layered-core-and-apps-boundary.md)), and `mvn clean verify`
must mean the same thing on a laptop as in CI.

## Decision

**Integration tests that need a database run it in a container through
Testcontainers**, using the same PostgreSQL major version the product deploys
on. They are named `*IT` and run under failsafe (`integration-test` and `verify`
goals); unit tests run under surefire and need no container.

**A suite that cannot find a Docker-compatible runtime fails; it does not
skip.** No suite opts into Testcontainers' skip-when-Docker-is-missing
behaviour, and the CI workflow (`.github/workflows/build.yaml`) checks
`docker info` explicitly before `mvn verify`, so a missing runtime fails with a
clear cause rather than a confusing test error.

**Shared SQL and data fixtures live in `infra/test-fixtures/`** and are wired into
the modules that need them through a `testResources` entry resolved from
`${maven.multiModuleProjectDirectory}`, rather than copied into each module.

## Rationale

Code whose job is talking to a database needs a real database, which rules out
embedded emulation. A container started per suite gives a real engine, real
Flyway migrations and real constraint behaviour, with no state carried between
runs.

The fail-not-skip rule exists because the alternative fails open. With a skip,
`mvn clean verify` on a machine without Docker reports the integration tests as
skipped and still prints `BUILD SUCCESS`: a green build that never exercised the
adapter against a database. A green build must mean the suites ran. Failing makes
the missing prerequisite a visible, one-line problem instead of a silent gap in
coverage.

Fixtures are shared because the same schema and seed data are needed by more
than one module's suites, and duplicated SQL drifts.

## Alternatives considered

### H2 or another embedded database — rejected

The fastest option, with a hermetic build and no Docker requirement. Rejected
because H2's dialect, catalog behaviour and constraint semantics are not
PostgreSQL's, and a PostgreSQL-specific migration either fails on it or passes
while meaning something else. Testing the adapter against an emulation tests a
fiction.

### A long-lived shared database for tests — rejected

One database started by `compose` or provided by CI, reused across runs. Faster
to start. Rejected because state leaks between runs and between suites, a
failing run leaves debris for the next one, and a local run depends on something
the developer must remember to start.

### Skip integration suites when Docker is absent — rejected

Testcontainers supports it with one attribute, and it keeps the build green on a
machine without a container runtime. Rejected because a build that is green
without having run its integration suites is the failure this record exists to
prevent.

### Duplicate fixtures inside each module — rejected

Would avoid cross-module resource wiring and let each module build alone.
Rejected because the same fixtures serve several modules, and copies drift.

## Consequences

### Positive

- Integration suites run against the real engine, with the real migrations,
  exactly as CI does.
- A green `mvn clean verify` means every suite ran.
- One set of fixtures serves every module that needs it.

### Negative

- **The build is not hermetic.** Every contributor needs a Docker-compatible
  runtime to run `mvn clean verify` to completion. Without one, the build fails
  — by design, and inconveniently.
- Container start-up makes integration suites slower than unit tests, which is
  one more reason to keep rules in `core`, where they need no container.
- **Modules that read shared fixtures cannot be built standalone.** Their
  `testResources` resolve through `${maven.multiModuleProjectDirectory}`, so they
  depend on the reactor root layout, which trades away part of the module
  independence [ADR-002](ADR-002-layered-core-and-apps-boundary.md) is built on.
- Fixture changes affect every consumer at once. There is no versioning of
  shared fixtures, so a change made for one suite can break another.
