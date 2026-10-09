# App

<One or two sentences: what the product is and who it serves. Replace this
paragraph when the project starts.>

This file is the project's glossary: the words the code, the specifications, the
ADRs and the issues are expected to use, and the words they are expected not to
use. It is a glossary and nothing else. Decisions live in
[`docs/adr/`](docs/adr/); build and contribution rules live in
[`CLAUDE.md`](CLAUDE.md).

**How to extend it.** Add a term when a specification, an ADR or a review
settles what a word means. Each entry is the **term**, a definition of a few
lines, and an `_Avoid_:` line naming the synonyms that must not be used for it.
When two terms are easy to confuse, add a short paragraph after them saying how
to tell them apart. Group domain terms under a heading per subdomain, matching
the `core` package name (`domain.<subdomain>`).

## Language

### Structure

**Ring**:
A concentric division *inside* `core` — `domain`, `flows`, `ports` — where
dependencies point inward (`flows → ports → domain`) and `domain` points nowhere.
Applies only inside `core`; `core` is one Maven artifact, so a ring is a package
boundary.
_Avoid_: layer, tier, onion layer

**Layer**:
A stacked division *across* Maven modules — `apps` → `adapters` → `core` — where
each level may depend on the levels beneath it. Applies only between modules; a
layer boundary is a POM dependency edge.
_Avoid_: ring, tier, module group

Ring and layer are two different shapes, not two words for one thing. A
statement about `domain` and `ports` is about rings; a statement about `apps/api`
and `core` is about layers. See
[ADR-002](docs/adr/ADR-002-layered-core-and-apps-boundary.md).

**Subdomain**:
A cohesive slice of the model, named by one package segment repeated in each
ring — `domain.item`, `flows.item`, `ports.item`. Each ring subdivides by
subdomain; a class in no subdomain package belongs to a cross-cutting one
(`error`, `security`, `time`, `identity`, `transaction`).
_Avoid_: module, feature, component

**Composition root**:
The one place that constructs adapters and wires them into flows — `apps/api`.
The CLI and the BFF are clients of the API, not composition roots.
_Avoid_: bootstrap, main module, container

**Adapter**:
A library under `adapters/` that implements one or more ports against a real
technology — `adapters/persistence` (PostgreSQL), `adapters/jvm` (clock, ticker,
UUIDs).
_Avoid_: port, driver, integration, gateway

### The domain ring

**Entity**:
A domain object with an identity that outlives changes to its attributes. Its
identifier is a UUID.
_Avoid_: model, record (when you mean the concept), row

**Value object**:
An immutable domain value defined entirely by its attributes, validated on
construction.
_Avoid_: DTO, bean, struct

**Policy**:
A stateless domain rule a flow applies — a pure function of domain values.
_Avoid_: service, helper, util

**Application problem**:
A failure the domain or a flow reports in domain terms — `ApplicationProblem`,
carried by a `ProblemException`, classified by a `ProblemKind` (not found,
conflict, invalid, ...). Only `apps/api` maps a `ProblemKind` to an HTTP status.
_Avoid_: HTTP error, API exception, error code (the `code` is the wire's
rendering of a problem, not the problem)

### The flows ring

**Flow**:
A use case: one operation the application offers, orchestrating domain values
and ports. A flow is called directly by the composition root's inbound code;
there is no input-port interface in front of it.
_Avoid_: service, interactor, use-case class, handler

### The ports ring

The `ports` ring holds three kinds of thing, and only these three. "Port" names
the first one alone.

**Port**:
An outbound interface — the shape `core` declares for calling the world. Every
crossing out of the domain is one: storage, time (`TimeSource`, `Ticker`),
identity (`IdGenerator`), transactions (`UnitOfWork`). Outbound only: there is no
inbound or driving port here, by
[ADR-002](docs/adr/ADR-002-layered-core-and-apps-boundary.md).
_Avoid_: gateway, adapter, inbound port, driving port, input port

**Port DTO**:
A record in the `ports` ring that is a port's own vocabulary — neither a domain
value nor a wire type.
_Avoid_: DTO, model, payload, port model

**Port failure**:
An exception a port declares, defined in the `ports` ring —
`UniqueConstraintViolation` is the worked example: the persistence adapter
raises it, and the flow turns it into an application problem.
_Avoid_: error, port exception, port error

### The wire

**Contract**:
A hand-maintained OpenAPI document owned by the module that serves it —
`apps/api/src/main/openapi/openapi-v1.yaml` (application API) or
`portal/bff/src/main/openapi/portal-api-v1.yaml` (browser to BFF).
Code is generated from it; it is never generated from code.
_Avoid_: spec (that is a functional specification), schema, swagger

**Contract type**:
A class generated from a contract (`com.example.app.api.contract.model`,
`com.example.app.cli.contract`). The truth of the wire, never of the domain or
the database; it may not appear below `apps/`.
_Avoid_: DTO, model, domain object

### Item (example subdomain — replace)

**Item**:
The template's example entity, carried end to end so every layer has a worked
example: an identifier, a unique `name` (1 to 120 characters), an optional
`description` (up to 1000), and `createdAt` / `updatedAt` instants. Replace it —
and this section — with the first real aggregate of the project, and delete it
once nothing needs the example.
_Avoid_: object, entry, record, thing

### Security

**Role**:
One of `AppRole` — `READER`, `EDITOR`, `ADMIN`. Independent grants, not a
hierarchy. Reads need `READER`, writes need `EDITOR`.
_Avoid_: permission, scope, group (a group is the identity provider's; the
roles claim is what the API reads)

**Subject**:
The caller's identity as the API sees it — the JWT `sub` claim, or the fixed
development subject in `dev-token` mode.
_Avoid_: user id, principal (in prose), login

### Delivery planning

Each kind of fact has exactly one home. A document that states a fact it does not
own cannot stay true.

**Obligation**:
An `FR`, `SEC` or `AC` in a functional specification — the normative floor.
Owned by [`docs/spec/`](docs/spec/) alone.
_Avoid_: requirement (ambiguous between this and a feature), acceptance criterion
when you mean the whole set

**Feature**:
One `In scope` bullet of a specification's section 2.1, identified `FS-0XX-F##`.
The unit that carries a priority and a result. Coarser than an obligation, finer
than a specification.
_Avoid_: capability, epic, story

**Priority**:
A feature's product-absolute MoSCoW tier — Must, Should, Could or Won't — what it
is worth to the product, never when it ships. Owned by
[`docs/plans/feature-register.md`](docs/plans/feature-register.md).
_Avoid_: release, schedule, importance

**Result**:
Whether a feature is delivered, and the reproducible evidence for that. Recorded
only in the feature register, and only from a green build plus a direct read of
the merged tree — never from an issue's closed state.
_Avoid_: status (that is an issue's), progress, done

**Implementation plan**:
The ordering of remaining work — what to do next. Owned by
[`docs/plans/implementation-plan.md`](docs/plans/implementation-plan.md). It
records no result, no priority and no issue state.
_Avoid_: roadmap, schedule, release plan

**Wave**:
An execution batch in the implementation plan: issues sharing a surface, sized so
one person or agent reads that surface once. Not a priority bucket and not a
sprint.
_Avoid_: sprint, milestone, phase

### Document status

One vocabulary across plans, specifications and decision records.

**Live**:
Maintained, and safe to act on. Plans and registers only.

**Approved**:
The implementation and acceptance contract. Specifications only.

**Accepted**:
Agreed and in force. ADRs only.

**Proposed**:
Written but not yet agreed. Nothing may be claimed against it.

**Superseded**:
Replaced by a named successor, which the document links. Kept for the record.

**Frozen**:
Deliberately unmaintained and kept as evidence of what was believed at a date.
Never guidance. A frozen document that something still depends on is a defect,
not a state.
