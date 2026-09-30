# ADR-023: Identifiers are UUIDs

- Status: Accepted
- Date: Template baseline
- Related: [ADR-004](ADR-004-core-touches-no-io.md),
  [ADR-008](ADR-008-postgresql-spring-jdbc-flyway.md),
  [ADR-012](ADR-012-generated-contracts-and-remote-frontend-state.md),
  [ADR-015](ADR-015-archunit-nightly-ring-report.md),
  [ADR-020](ADR-020-resource-shape-and-url-nesting.md),
  [ADR-021](ADR-021-one-migration-stream-and-one-baseline.md)

## Context

Every aggregate needs an identity, and the choice is made again for each new
table unless it is written down. The failure worth preventing is not a bad
choice but a *mixed* one: a primary key declared as free text "to stay
flexible", so that configuration-seeded rows keep human slugs (`'default'`,
`'legacy'`) while rows created through the API receive generated ids. The column
then holds **two id vocabularies at once**, with nothing in the schema or the
type system to tell a reader which one a given value is. Code that matches ids
across tables — a deletion guard, a join, a cache key — silently works for one
vocabulary and not the other, and a second writer that fills the column from its
own vocabulary (an alias, a placeholder, an empty string when nothing was named)
produces rows no lookup will ever match.

The same drift appears between layers: an id that is a `uuid` in the database, a
`String` in the domain, and an unconstrained `string` on the wire invites every
layer to accept values the others would reject.

## Decision

**Every identifier is a UUID, at every layer.**

- **Database.** Every primary key is `uuid PRIMARY KEY`, and every column that
  references an identity is `uuid`, with a foreign key where the referenced row
  lives in the same database. `item.id` is the template's example.
- **Core.** Identities are `java.util.UUID` (or a value object wrapping one),
  never `String`. A flow that creates an aggregate obtains its id from the
  `ports.identity.IdGenerator` port, so the id is known before the row is
  written and a test can fix it. `adapters/jvm` implements the port over
  `UUID.randomUUID()` (version 4). `core` never calls `UUID.randomUUID()`
  itself: inventing an identifier is a side effect, and the nightly ArchUnit
  report flags it ([ADR-015](ADR-015-archunit-nightly-ring-report.md)).
- **Wire.** In `openapi-v1.yaml` every id field and every id path parameter
  (`{itemId}`) is `type: string, format: uuid`, so generated server interfaces
  and clients carry a `UUID`, not a `String`
  ([ADR-012](ADR-012-generated-contracts-and-remote-frontend-state.md)). A path
  segment that does not parse as a UUID is refused at the edge and never
  reaches `core`.
- **Human names are a separate field.** An aggregate that people refer to by
  name carries that name as its own column, with its own uniqueness constraint
  where needed (`item.name`), and never as the identity. Renaming it changes no
  reference.
- **A row whose id is fixed by configuration** — a seed, a fixture — carries a
  literal UUID in that configuration, with the human slug kept as a comment
  beside it.
- **A derived identifier is a version-8 UUID.** Where the same inputs must
  produce the same id in every process and across a rebuild, the id is a hash
  (SHA-256) of a readable, versioned namespace string and the inputs, joined by a
  separator no input can contain, with the version-8 and RFC variant bits set
  (RFC 9562). Versions 3 and 5 are not used unless the MD5 or SHA-1 construction
  they name is the one actually performed: a version byte is a claim about how
  the id was formed.

## Rationale

**One vocabulary per column.** When every identity is a UUID, a value's type
says what it is, and any code that compares ids compares like with like. A
column that can hold "a slug or a generated id" is a column no reader can
reason about.

**Generated in the application, through a port.** Assigning the id in the flow
rather than by a column default means the flow can return it, build a
`Location` header, or reference it in the same unit of work without reading it
back. Routing the generation through `IdGenerator` keeps `core` deterministic
under test ([ADR-004](ADR-004-core-touches-no-io.md)) and makes a change of
generation strategy one adapter.

**Opaque, not enumerable.** A UUID in a URL reveals nothing about how many rows
exist or in what order they were created, and it does not collide when data from
two environments or two branches meets.

**Typed on the wire.** Declaring `format: uuid` on the contract means the
generated code rejects a malformed id before any application code runs, and the
contract documents the shape clients must send.

## Alternatives considered

### Database sequences (`bigserial`) — rejected

Compact and ordered, but the database assigns them, so a flow cannot know an id
before the insert. They are enumerable in a URL, and two databases hand out the
same numbers, which makes merging fixtures or data across environments a
renumbering exercise.

### Natural keys or slugs as the primary key — rejected

Readable, and it couples identity to a value people want to change. Renaming
becomes a cascading update, and a table whose seeded rows use slugs while
created rows use generated ids ends up with the mixed vocabulary this record
exists to prevent.

### A free-text id column that accepts either — rejected

It defers the choice rather than making it, and every consumer inherits the
ambiguity. A migration that later narrows the column to `uuid` has to decide
what to do with values that never were ids.

### Mislabelled derived ids (`UUID.nameUUIDFromBytes` over a SHA-256 digest) — rejected

Structurally valid UUIDs that announce version 3 — MD5 over a namespace UUID —
for a construction nobody ran. Switching the hash to earn the label would trade
SHA-256 for a weaker one to satisfy a name; version 8 exists for exactly this
case.

## Consequences

### Positive

- One id type in every table, domain value and contract field.
- Ids are known in the flow before persistence, and fixed in tests through
  `IdGenerator`.
- Generated server code and clients reject malformed ids at the edge.
- Changing the generation strategy — a time-ordered version 7, say — is a change
  to one adapter, not to every flow.

### Negative

- **Sixteen bytes per key**, and random version-4 keys insert out of order into
  a B-tree index. Neither matters at the scale the template targets; a project
  where it does can switch `IdGenerator` to a time-ordered version.
- **UUIDs are unreadable in logs and support conversations.** That is what the
  separate name field is for.
- **Collisions are improbable, not impossible.** Generated and derived ids share
  one 122-bit space; the guarantee is probabilistic, as it is for every UUID.
- **Version 8 is younger than some tooling.** A validator written against RFC
  4122 may reject a derived id; the honest label is worth that risk.
