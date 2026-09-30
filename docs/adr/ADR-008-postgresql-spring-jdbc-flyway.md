# ADR-008: PostgreSQL persistence with Spring JDBC and Flyway, no JPA

- Status: Accepted
- Date: Template baseline
- Related: [ADR-002](ADR-002-layered-core-and-apps-boundary.md), [ADR-003](ADR-003-core-dependency-exclusions.md), [ADR-004](ADR-004-core-touches-no-io.md), [ADR-007](ADR-007-spring-boot-http-api-composition-root.md), [ADR-021](ADR-021-one-migration-stream-and-one-baseline.md), [ADR-023](ADR-023-identifiers-are-uuids.md)

## Context

The application needs durable state from its first resource onward. `core`
defines what it needs to store through ports such as `ItemRepository` and
`UnitOfWork`, and it cannot carry a database driver, an ORM annotation, or a
`@Transactional` annotation ([ADR-003](ADR-003-core-dependency-exclusions.md),
[ADR-004](ADR-004-core-touches-no-io.md)). Something has to implement those
ports, own the schema they assume, and be connected to a real database by
whoever starts the process.

Most application state is relational: identities, uniqueness, conditional
updates, filtered and paged listings. Those need transactions and constraints,
and a query set small enough to read in full.

## Decision

Persistence is one outbound adapter, `adapters/persistence` (artifact
`adapter-persistence`, package `com.example.app.persistence`), backed by
PostgreSQL.

- It implements the `core` ports with Spring JDBC (`JdbcClient`) and explicit
  SQL. Every statement the application runs against its database is in this
  module.
- Flyway versioned migrations exclusively manage the schema, and they live in
  the same module (`db/migration`), beside the SQL that assumes them. The
  baseline `V1__baseline.sql` creates the `item` table; the stream is governed
  by [ADR-021](ADR-021-one-migration-stream-and-one-baseline.md).
- JPA, Hibernate, runtime schema generation, and PostgreSQL native enum types
  are not used. An enum stored by the application is text constrained by a
  `CHECK`, so adding a value is a migration, not a type alteration.
- The adapter owns no connectivity. The datasource, pool, and credentials are
  assembled by the composition root (`apps/api`,
  [ADR-007](ADR-007-spring-boot-http-api-composition-root.md)) from `APP_`
  environment variables and injected. The adapter never reads configuration
  for itself.
- Database constraints are the last line of each invariant. A unique-key
  violation is translated inside the adapter into `core`'s
  `UniqueConstraintViolation`, so a flow can turn it into a `ProblemKind`
  without knowing a SQLSTATE.
- A flow that needs several port calls to be one atomic decision takes the
  `UnitOfWork` port, which the composition root binds to the transaction
  manager of the injected datasource.
- The application fails closed when the database is unavailable. It never falls
  back to an in-memory store.

## Rationale

PostgreSQL supplies what the application needs with one mainstream technology:
uniqueness, transactions, ordered and indexed queries, `CHECK` constraints, and
JSONB where a value is stored but never searched.

Explicit SQL keeps the persistence model visible. The query set is small and
concrete; an ORM would add identity-map and session semantics that do not help,
and its annotations would sit one careless import away from `core`. With
`JdbcClient`, the port's types are plain Java records and the mapping is a few
lines a reviewer can read.

Keeping migrations next to the SQL means one module changes when the schema
changes, and one review sees both halves. Keeping connectivity out of the
adapter means the same adapter serves the API, integration tests with
Testcontainers ([ADR-006](ADR-006-testcontainers-for-integration-tests.md)),
and any future composition root without each learning a different way to find
a database.

## Alternatives considered

### JPA / Hibernate — rejected

Mainstream and productive for aggregate CRUD. It also brings lazy loading,
dirty checking, a persistence context whose lifetime has to be managed, and
entity annotations that invite a domain type to become a table mapping. The
application's queries are few and deliberate; SQL is clearer for them and keeps
ORM types from crossing the port.

### Runtime schema generation (`ddl-auto`) — rejected

It makes the schema a side effect of the code instead of a reviewed artefact,
and gives no controlled path for changing a table that already holds data.

### PostgreSQL native enum types — rejected

Adding a value requires `ALTER TYPE`, which has transactional restrictions and
couples the Java enum's evolution to a type-level migration. A text column with
a `CHECK` is changed like any other constraint.

### Adapter-owned datasource configuration — rejected

An adapter that reads its own properties decides where credentials come from.
That decision belongs to the composition root, which is the one place that
knows the environment it runs in.

### An in-memory fallback when the database is down — rejected

It turns an outage into silent data loss: a request is acknowledged and its
effect disappears on restart.

## Consequences

### Positive

- Uniqueness and conditional updates are protected by database constraints and
  transactions.
- `core` remains independent of the chosen store; a second vendor adapter would
  implement the same ports.
- Schema and SQL change in one module and one review.
- Every query the application runs can be found by reading one module.

### Negative

- Mapping code is hand-written; a new column means editing the SQL and the row
  mapper together.
- The API needs a reachable PostgreSQL to start and to serve; there is no
  degraded mode.
- The schema is a migration and backup concern from the first release.
