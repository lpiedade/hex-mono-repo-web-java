# ADR-012: Generated contracts and remote frontend state

- Status: Accepted
- Date: Template baseline
- Related: [ADR-002](ADR-002-layered-core-and-apps-boundary.md), [ADR-007](ADR-007-spring-boot-http-api-composition-root.md), [ADR-009](ADR-009-react-typescript-and-spring-bff.md), [ADR-022](ADR-022-contract-versions-allocated-at-delivery.md), [ADR-024](ADR-024-sorting-follows-the-collection.md), [ADR-026](ADR-026-cli-is-a-client-of-the-api.md), [ADR-027](ADR-027-feature-sliced-design-for-the-spa.md)

## Context

Three clients consume the API's wire format: the BFF, the SPA, and the CLI.
Hand-written request and response types in Java and TypeScript drift from the
API silently, and the drift is discovered at runtime. The opposite mistake is
also available: once a type is generated from the contract, it is convenient to
store it, pass it into a flow, or use its enum as the domain's — at which point
editing the contract changes what the database accepts, with no review step
between the two.

On the browser side, ad-hoc fetch caches and business decisions in components
produce inconsistent loading, retry, error, and authorization behaviour.

## Decision

### Contracts are the source, and code is generated from them

- `docs/arch/api-layer/openapi-v1.yaml` is hand-maintained and authoritative
  for the API. The API serves it at `/v3/api-docs.yaml`.
  `ContractPathsAreServedTest` fails the build when a declared path has no
  controller mapping.
- `docs/arch/api-layer/portal-api-v1.yaml` is the browser-to-BFF contract. Its
  schemas `$ref` the API's rather than restating them, and
  `BffContractParityTest` fails when an `x-proxies-to` upstream is not declared
  in `openapi-v1.yaml`.
- Java models are generated from `openapi-v1.yaml` into
  `com.example.app.api.contract.model` in `apps/api`; the CLI generates its
  client into `com.example.app.cli.contract` from the same file. The SPA's
  TypeScript types are generated from `portal-api-v1.yaml` and used through a
  typed fetch client. No internal Java domain, persistence, or controller class
  is shared with any client.
- The API's response bodies carry `schemaVersion`; the portal contract is
  versioned independently by `portalApiVersion`, sent as
  `X-Portal-Api-Version: 1`. How versions advance is
  [ADR-022](ADR-022-contract-versions-allocated-at-delivery.md).

### Generated types are the truth of the wire, never of the domain

A type from `com.example.app.api.contract.model` may not appear below `apps/`.
`core` owns the enums and values it stores, and each surface has one explicit
translation at the edge in `apps/api`. Where a domain enum and a contract enum
coincide today, the translation is still written out, so that the two are free
to diverge and there is one place where the divergence is absorbed.

This rule needs no separate check: the models are generated inside `apps/api`,
and no module below `apps/` depends on `api`, so the types are unreachable from
`core`, the adapters, and `portal/bff`. Breaking the rule requires adding a POM
dependency, which is a reviewable change.

### Remote state in the SPA

- React Router owns routes; TanStack Query (React Query) owns server state. No
  Redux or other global store while those two suffice.
- An enum or version value the SPA does not recognise renders as unsupported,
  and any mutation depending on it is disabled.
- Collections are filtered, sorted, and paged by the API
  ([ADR-024](ADR-024-sorting-follows-the-collection.md)); the browser never
  loads a whole collection to compute a total or a sort.
- A mutation changes visible state only after the API confirms it, then
  invalidates the affected queries. No optimistic updates.
- Where polling is needed it is cancellable, pauses in hidden tabs, and honours
  `Retry-After`.
- URL state is limited to opaque identifiers and safe filters. Tokens and
  sensitive values never enter the URL or persistent browser storage.

## Rationale

Generated clients turn contract drift into a build failure. Generating from a
hand-maintained contract, rather than generating the contract from annotations,
means the wire is designed and reviewed as a document, and the build proves the
code serves it.

Keeping generated types at the edge costs one mapping per surface and buys the
freedom to change the wire without migrating the database, and to change the
schema without breaking a client.

A focused remote-state library handles caching, cancellation, retry, and
invalidation without a second, hand-written global state model. Server-side
filtering and paging keep responses bounded however large a collection grows.

## Alternatives considered

### Hand-write clients and DTOs — rejected

Contract changes would be discovered late, and a misread field would fail
silently.

### Generate the contract from controller annotations — rejected

The contract would become whatever the code happens to do. A designed contract
with a test that the code serves it keeps the wire a deliberate decision.

### Share Java domain models with the BFF or CLI — rejected

It couples clients to internal implementation and leaks fields that were never
part of the contract.

### Let generated models serve as domain or persistence types — rejected

It saves a mapping and makes the contract file a schema migration nobody
reviews as one.

### Redux for all state — rejected

Server state and local component state cover the use cases; a global store
would duplicate what the query cache already holds.

### WebSocket or server-sent events — rejected

HTTP polling is sufficient where freshness matters, and a push channel would be
a second contract to design, secure, and version.

## Consequences

### Positive

- Contract drift fails the build.
- The domain and the database evolve independently of the wire.
- Listing behaviour stays bounded and reproducible.
- Stale requests and unconfirmed mutations have explicit handling; frontend
  business logic stays minimal.

### Negative

- Code generation is part of both the Maven and the npm toolchains.
- Every contract enum that mirrors a domain enum needs a written translation.
- The API and portal contracts require coordinated compatible releases.
- An unrecognised enum value temporarily reduces what the UI can do.
