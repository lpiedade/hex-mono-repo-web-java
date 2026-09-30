# ADR-002: A layered core and an apps/ boundary

- Status: Accepted
- Date: Template baseline
- Related: [ADR-001](ADR-001-java-25-maven-multi-module.md), [ADR-003](ADR-003-core-dependency-exclusions.md), [ADR-004](ADR-004-core-touches-no-io.md), [ADR-005](ADR-005-abstractions-for-a-current-use-case.md), [ADR-007](ADR-007-spring-boot-http-api-composition-root.md), [ADR-009](ADR-009-react-typescript-and-spring-bff.md), [ADR-012](ADR-012-generated-contracts-and-remote-frontend-state.md), [ADR-015](ADR-015-archunit-nightly-ring-report.md), [ADR-016](ADR-016-one-logging-story-and-a-silent-core.md), [ADR-026](ADR-026-cli-is-a-client-of-the-api.md)

This is the record of the template's overall architectural style. The other
records hang from it.

## Context

A service built on this template will have business rules, a database, an HTTP
contract, a browser front end and a command-line client. Each of those pulls on
the code in a different direction, and without a stated style the pull wins by
default: the SQL shapes the model, the HTTP contract's generated types become the
database's column values, and the rules end up inside whichever controller was
written first.

The failure modes are specific and worth naming, because the rules below exist
to prevent them:

- **The published contract owns the schema.** When enums generated from the
  OpenAPI document are persisted directly as column values, editing the contract
  changes what the database accepts, with no review step between the two.
- **A model shaped by its storage.** When the dependency direction runs toward
  infrastructure, the domain model takes whatever shape the JDBC `ResultSet`
  happens to return, and a second storage technology becomes a special case
  inside the business code.
- **A catch-all middle.** A module called `core` with only subdomain packages
  gives no vocabulary for the difference between an invariant and an
  orchestration, or between a port's DTO and a domain value. Nothing in a package
  named `item` argues against file I/O living there, so it can.
- **A root that does not distinguish kinds.** When deployables, libraries and
  scaffolding are siblings at the repository root, a reader cannot tell which is
  which.

## Decision

### Ports and adapters, with the build as the enforcer

`core` owns the domain model and the outbound ports. Every adapter is its own
Maven module under `adapters/`, implements one or more ports, and depends on
`core`. `core` depends on no other module in the reactor. Applications under
`apps/` are the composition roots that wire adapters into flows.

| Module | Directory | Depends on |
| --- | --- | --- |
| `core` | `core/` | nothing in the reactor |
| `adapter-persistence` | `adapters/persistence` | `core` |
| `adapter-jvm` | `adapters/jvm` | `core` |
| `api` | `apps/api` | `core`, `adapter-persistence`, `adapter-jvm` |
| `cli` | `apps/cli` | nothing in the reactor ([ADR-026](ADR-026-cli-is-a-client-of-the-api.md)) |
| `portal` | `portal/` | nothing in the reactor at runtime ([ADR-009](ADR-009-react-typescript-and-spring-bff.md)) |

Domain values are immutable records with defensive copies (`List.copyOf`) and
deterministic ordering, so that equal input yields equal values.

### Three package rings inside `core`

| Ring | Package | Holds | Admits |
| --- | --- | --- | --- |
| `domain` | `com.example.app.domain.<subdomain>` | entities, value objects, enums, domain exceptions (`ApplicationProblem`, `ProblemKind`, `ProblemException`), stateless policies | no I/O, no framework, no generated contract type |
| `flows` | `com.example.app.flows.<subdomain>` | use cases — orchestration over ports (`CreateItemFlow`) | the same, plus the ports it composes |
| `ports` | `com.example.app.ports.<subdomain>` | outbound interfaces and the DTOs that are a port's own vocabulary (`ItemRepository`, `TimeSource`, `UnitOfWork`) | the same |

Dependencies run `flows → ports → domain`. `domain` depends on nothing.

Each ring subdivides by subdomain. A business subdomain appears in each ring it
needs (`domain.item`, `flows.item`, `ports.item`); a cross-cutting concern is a
subdomain of its own (`domain.error`, `domain.security`, `ports.time`,
`ports.identity`, `ports.transaction`). No class sits in a ring's root package.

The rings are packages, not modules. `core` stays a single artifact, so
[ADR-003](ADR-003-core-dependency-exclusions.md)'s enforcer rule guards all
three at once. [ADR-015](ADR-015-archunit-nightly-ring-report.md) reports on the
ring directions nightly.

### The model lives in `core`, never in an application

A subdomain's model and its persistence belong in `core` and `adapters/`, never
in an application. A type generated from the HTTP contract
(`com.example.app.api.contract.model`) may not be stored, nor held as state,
below `apps/`. Where a domain enum and a contract enum coincide, an explicit
translator in `apps/api` names the correspondence.

This is mechanical rather than a convention: the models are generated inside
`apps/api`, and no module below `apps/` declares a dependency on `api`, so the
types are unreachable from `core` and the adapters. Breaking it requires adding
a POM dependency, which is a reviewable change.

A flow reports failure as an `ApplicationProblem` carrying a `ProblemKind`,
never an HTTP status. The mapping from `ProblemKind` to HTTP is one switch in
`apps/api`.

### Every crossing out of the domain is a named port

Reading or writing anything outside the process — a database, a file, a socket,
the clock, a random source — goes through a port with an adapter.
[ADR-004](ADR-004-core-touches-no-io.md) states the rule and its limits.

### The repository root has four kinds of directory

| Kind | Directories |
| --- | --- |
| Product code | `core/`, `adapters/`, `apps/`, `portal/` |
| Scaffolding that builds, runs or verifies the product and ships in none of it | `infra/` (`docker`, `scripts`, `terraform`, `test-fixtures`) |
| Documentation | `docs/` |
| Tooling the repository does not own | `.github/` |

**Anything with a `main` lives under `apps/`.** `apps/api` is the composition
root; `apps/cli` is a client of it. `core/` and `adapters/` are libraries.
`portal` is the one exception: `portal/web` (React) and `portal/bff` (Spring
Boot) are two halves of one deliverable and keep a root of their own.

## Rationale

The model lives in `core` so that adapters map *into* it. Business code then has
exactly one shape to reason about, however many storage technologies or vendors
are added later, and it is testable with no database, no container and no
framework. Determinism is built into the model rather than applied downstream
because a value that is only sometimes sorted is a bug waiting for the second
caller; sorting at construction makes it a property of the type.

A dependency edge in a POM is a stronger guarantee than a naming convention or
an architecture test. Violating it requires a reviewable change to a build file
rather than an edit a reader could miss, and it fails at compile time rather
than in a test that can be ignored. One module per adapter buys that
enforcement for the rule the whole design rests on, and gives the next adapter a
concrete template to copy.

The rings are named for what they admit, not for how important they are. "Core"
says only "the middle"; it is the same word as `common` or `util`, and it
accretes the same way. Three named rings turn "where does this go?" into a
question with an answer a reviewer can check.

They are packages rather than modules because the property worth enforcing at
build time is the one [ADR-003](ADR-003-core-dependency-exclusions.md) already
enforces: no framework, no driver, no ORM anywhere inside `core`. Three Maven
modules would additionally catch `domain` importing `flows`, at the cost of three
POMs and a slower reactor. A nightly report is proportionate for the second; the
build must own the first.

Keeping generated contract types out of storage is not about symmetry. A core
enum plus an explicit translator does not prevent the contract and the schema
from agreeing — most translations are a `valueOf` over `name()` — it makes
disagreeing possible, and makes the place where a disagreement would be absorbed
obvious.

`apps/` costs one directory level and buys a rule with a single, stated
exception: if it has a `main`, it is under `apps/`. Naming `infra/` as the one
home for scaffolding does the same for the directories that are neither product
nor documentation.

## Alternatives considered

### Classic layering (controller / service / repository) — rejected

Familiar to any Java team and less ceremony to set up. Rejected because the
dependency direction runs toward infrastructure: the service depends on the
repository, so the model ends up shaped by the storage technology, and the rules
cannot be tested without it.

### Adapters as packages in one module, checked by ArchUnit — rejected

Fewer modules, a simpler reactor, and the dependency rule expressed as an
executable test. Rejected because an ArchUnit rule is test code: it can be
deleted, disabled or excluded from a run, and a violation surfaces as a failing
test someone can mark as ignored. A Maven dependency edge cannot be violated
without editing a POM. [ADR-015](ADR-015-archunit-nightly-ring-report.md) uses
ArchUnit only where no POM edge is available — inside `core` — and as a report,
not a gate.

### Adapter modules at the reactor root — rejected

A simpler path with no nested `<relativePath>`. Rejected because adapters are a
kind, and naming the axis costs one directory level: `adapters/persistence`,
`adapters/jvm`, and a second vendor adapter would sit beside them.

### One flat `core` relying on subdomain packages — rejected

No vocabulary for the difference between an invariant and an orchestration, and
none for a port DTO versus a domain value. It is how file I/O ends up inside the
domain: nothing in a subdomain's package name argues against it.

### Three Maven modules under `core/` — rejected for now

Would make `flows → ports → domain` a build-verified fact. Rejected as
disproportionate: three POMs and a slower reactor for a direction that
[ADR-015](ADR-015-archunit-nightly-ring-report.md) can report on nightly. Worth
revisiting if the report starts finding leaks faster than they are fixed.

### Generate the OpenAPI models into a shared module `core` can depend on — rejected

The cheapest way to avoid a domain enum and a contract enum that mirror each
other, and rejected for exactly that reason: it would make the wire contract the
domain model by construction, which is the coupling this record removes.

### Full Clean Architecture — an input port per use case — rejected

A driving port (an interactor interface plus request and response models) for
each endpoint. Rejected because its usual justification does not apply: flows
are plain classes that a test constructs directly, so the interface would buy
indirection rather than isolation. [ADR-005](ADR-005-abstractions-for-a-current-use-case.md)
states the general rule.

## Consequences

### Positive

- `core` is testable with no database, no container and no Spring context.
- Adding a storage technology or vendor is additive: implement the port in a
  sibling module, map into the same model, and `core` is untouched.
- The dependency rule is mechanically visible: `core` has no edge to any
  adapter, and the build fails if one is introduced. Each driver is confined to
  the one module that needs it.
- A change to the OpenAPI document cannot silently change what the database
  accepts.
- A flow carries a `ProblemKind`, not an HTTP status, so the same flow can serve
  any inbound protocol.

### Negative

- **Translators are duplication a compiler cannot check.** A contract enum
  renamed without renaming its domain twin fails at runtime on the first value
  that crosses, not at build time.
- **A ring is a convention inside one module.** Nothing at build time stops
  `domain` importing `flows`. The nightly report in
  [ADR-015](ADR-015-archunit-nightly-ring-report.md) reads bytecode, so it cannot
  see an import kept only for a Javadoc `{@link}`, and it blocks no pull request.
- **`portal` is an exception to `apps/`.** It is a deployable that does not live
  under `apps/`, on the grounds that `web` and `bff` are one deliverable. That is
  a judgement, and a reader must be told about it.
- Nested modules need `<relativePath>../../pom.xml</relativePath>`, which breaks
  on any reorganisation of the tree.
- **Three naming conventions describe one module**: the artifactId is
  `adapter-persistence`, the directory is `adapters/persistence`, and the Java
  package is `com.example.app.persistence`. Nothing breaks, but boundary
  discipline is the point of this record and the naming does not reflect it.
- A port with one adapter is asserted, not proven, to be neutral. The claim that
  a second vendor or storage technology will slot in cleanly remains unproven
  until a structurally different adapter exists.
