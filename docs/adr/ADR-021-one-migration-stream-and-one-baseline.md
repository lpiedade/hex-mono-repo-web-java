# ADR-021: One migration stream and one baseline per database

- Status: Accepted
- Date: Template baseline
- Related: [ADR-002](ADR-002-layered-core-and-apps-boundary.md),
  [ADR-006](ADR-006-testcontainers-for-integration-tests.md),
  [ADR-008](ADR-008-postgresql-spring-jdbc-flyway.md),
  [ADR-018](ADR-018-merge-commits-not-squash.md),
  [ADR-026](ADR-026-cli-is-a-client-of-the-api.md)

## Context

`adapters/persistence` owns the schema its SQL assumes, as Flyway migrations
([ADR-008](ADR-008-postgresql-spring-jdbc-flyway.md)). Two questions about that
schema come up as soon as a second subdomain arrives, and both are cheaper to
answer before the first real migration than after.

**How many Flyway streams?** Subdomains are real boundaries in `core`
([ADR-002](ADR-002-layered-core-and-apps-boundary.md)), and it is tempting to
give each one its own migration location and history table so its tables can
evolve "independently". The pull is strengthened by a small mechanical fact:
Spring Boot's Flyway scans `classpath:db/migration` recursively, so a
subdomain's migrations cannot live in a subdirectory of it without landing in
the same history and colliding on version numbers — a second location with its
own history table looks like the fix.

A stream per subdomain over one datasource buys nothing and costs a great deal:

- **An ordering rule that startup must enforce.** A stream that does not
  baseline refuses a non-empty schema, so whichever stream reaches the database
  second fails unless something orders them. That rule lives in bean wiring,
  invisible to anyone reading either stream.
- **Baselines that exist only to tolerate each other.** The usual cure is
  `baselineOnMigrate` on both, for no reason except that the other stream has
  already populated the schema. A baseline that is always on can no longer warn
  about a schema that is unexpectedly non-empty.
- **SQL that silently depends on both.** A query or a guard that joins tables
  from two streams is valid only because both happened to run. A test that
  applies one of them fails on a missing table and reads as a broken test rather
  than a missing migration.
- **Two version sequences to collide in.** Branches stack
  ([ADR-018](ADR-018-merge-commits-not-squash.md)), and sequential numbering
  across parallel worktrees already produces duplicate versions. Two sequences
  double the surface and halve the chance anyone notices, because listing one
  directory looks clean.

Against that, the split is never exercised: no table moves between streams, and
no stream is deployed without the others, because they are applied by the same
startup against the same datasource.

**How long may the chain grow before it stops describing the schema?** Early in
a project a migration chain is mostly churn: a column created with one type and
converted in the next file, a table created, renamed, then reshaped, a
constraint dropped and re-created one version later only to acquire an explicit
name. Anyone asking what the schema looks like *today* has to replay the chain
and know which steps were destructive, and a hand-maintained diagram becomes the
readable source of truth precisely because the authoritative one is unreadable.

## Decision

**A Flyway stream is a property of a database, not of a subdomain.** The
application database has one location, `classpath:db/migration` in
`adapters/persistence`, and one history table, `flyway_schema_history`. A
second stream is justified only by a second database reached through its own
datasource — which is this rule, not an exception to it.

- **No `baselineOnMigrate`.** With one stream a non-empty schema that Flyway did
  not create is a fact worth failing on, not one to tolerate.
- **Spring Boot's autoconfigured Flyway applies the stream** in the composition
  root. There is no hand-wired migrator bean and no ordering rule. Integration
  suites migrate a fresh Testcontainers database the same way
  ([ADR-006](ADR-006-testcontainers-for-integration-tests.md)). The CLI does not
  migrate anything: it is a client of the API
  ([ADR-026](ADR-026-cli-is-a-client-of-the-api.md)).
- **The stream starts from one baseline, `V1__baseline.sql`,** which creates the
  current schema and nothing else. In the template that is the `item` table. The
  next migration anyone writes is `V2`.
- **The baseline is hand-authored and readable** — inline `PRIMARY KEY`,
  `REFERENCES` and `CHECK`, named `uq_*` / `ck_*` / `idx_*` constraints and
  indexes, and a comment per invariant saying what it enforces and how a
  violation surfaces. It is not a `pg_dump`.
- Subdomains share the stream. A migration may declare a foreign key across
  subdomains, and should do so sparingly: the stream is not a boundary, but the
  subdomains in `core` are.

### When a merged migration may be rewritten

A merged migration is immutable — **unless** all of the following hold:

1. no deployment of the schema holds data that cannot be recreated;
2. every developer can drop their local volumes and migrate from empty;
3. the break is recorded in an ADR.

Collapsing the chain back into a fresh baseline, or renumbering it, is legal
exactly while that condition holds. The day the first installation holds data
that cannot be recreated, the condition stops holding **permanently**, and the
rule becomes absolute with no further decision needed. It is written down so
the next person does not re-derive the argument, and so the day it expires is
identifiable.

When a rewrite is done, **equivalence is proved, not asserted**: a catalog
snapshot — every column with its type, length, nullability, default and
relative position; every constraint via `pg_get_constraintdef`; every index via
`indexdef`; every comment — taken after replaying the old chain must be
identical to the one taken after applying the new baseline alone. The snapshot
reads the catalog rather than diffing SQL text, because PostgreSQL deparsing its
own parsed expression normalises constraints that are semantically identical but
textually different. Position is relative, not `ordinal_position`, because a
dropped column leaves a permanent gap no hand-authored `CREATE TABLE` can or
should reproduce. Existing databases are then recreated (`docker compose down
-v`), since a stale database fails startup on a checksum mismatch.

## Rationale

One stream per database matches what Flyway actually tracks: the state of a
schema in a database. A subdomain boundary is a property of the code, and the
code already enforces it; mirroring it in migration histories adds ordering and
tolerance machinery that protects nothing.

One readable baseline makes replaying the migrations the first move rather than
the fallback. A reader can open one file and see the schema; a diagram becomes a
reading aid rather than the only readable source.

The rewrite condition is narrow on purpose. It permits nothing once real data
exists, and it states that limit up front so that a rewrite is never argued as a
one-off "not a precedent" — a rule with a growing list of exceptions is not a
rule.

## Alternatives considered

### A stream per subdomain, with an explicit ordering bean — rejected

Removes the startup hazard and nothing else. The histories, the sequences and
the SQL that straddles them all remain. It treats the symptom.

### One stream, several locations, one history table — rejected

Flyway accepts several locations writing to one history table, which would keep
per-subdomain directories. Versions must still be unique across the locations,
so the directories buy only the appearance of a boundary the history table does
not enforce, and the collision surface is harder to see.

### Flyway's own baseline (`baselineOnMigrate` with a `baselineVersion`) — rejected

Lets existing databases record a new baseline as already applied. It
reintroduces the always-on baseline this record removes, and the databases it
would spare are, by the rewrite condition, ones that hold nothing worth sparing.

### Rewriting `flyway_schema_history` in place — rejected

A one-time SQL step collapsing applied rows into one baseline row with a new
checksum. It is a migration whose correctness cannot be tested against the thing
it must be correct about — somebody's existing database — and under the rewrite
condition no such database holds data worth the risk.

### Generating the baseline with `pg_dump --schema-only` — rejected as the deliverable, adopted as the oracle

Mechanically safe and fast. A dump emits `ALTER TABLE ONLY … ADD CONSTRAINT` for
every constraint, a `SET` / `pg_catalog` preamble, and no comments. The point of
a baseline is readability, and a dump does not deliver it; it is useful as a
cross-check of the hand-authored file.

## Consequences

### Positive

- **One version sequence to collide in**, and in a short chain a duplicate is
  noticed immediately.
- **SQL that joins subdomains is well-founded**: it is a property of one schema,
  not a coincidence of two migrators having run.
- **Startup has no ordering rule** and no baseline tolerance to explain.
- **The schema is readable from its source.**

### Negative

- **Every process that migrates creates every table**, including ones it never
  reads. A deployment cannot be told apart from another by inspecting which
  tables exist.
- **After a rewrite, a version number no longer identifies a file across
  history.** References in `docs/` and Javadoc should name the table or
  constraint they are about rather than a `V` number; commit messages keep their
  stale pointers, because rewriting history's account of itself is worse.
- **A rewrite loses the per-migration rationale and any test that stepped
  through an intermediate version.** The rationale survives in git
  (`git log --follow` on the deleted paths); a test that proved a data-carrying
  step was safe cannot survive a baseline with no such step in it.
- **The rewrite licence expires.** Once real data exists, every schema change is
  forward-only, and mistakes are corrected by new migrations.
