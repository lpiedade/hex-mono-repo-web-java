# ADR-007: Spring Boot HTTP API as the composition root

- Status: Accepted
- Date: Template baseline
- Related: [ADR-002](ADR-002-layered-core-and-apps-boundary.md), [ADR-003](ADR-003-core-dependency-exclusions.md), [ADR-005](ADR-005-abstractions-for-a-current-use-case.md), [ADR-008](ADR-008-postgresql-spring-jdbc-flyway.md), [ADR-009](ADR-009-react-typescript-and-spring-bff.md), [ADR-011](ADR-011-jwt-resource-server-and-roles.md), [ADR-012](ADR-012-generated-contracts-and-remote-frontend-state.md), [ADR-016](ADR-016-one-logging-story-and-a-silent-core.md), [ADR-026](ADR-026-cli-is-a-client-of-the-api.md)

## Context

`core` holds the model, the flows and the ports, and depends on no framework
([ADR-003](ADR-003-core-dependency-exclusions.md)). Something has to construct
the adapters, hand them to the flows, and expose the flows to callers. The
callers are a browser front end through its backend-for-frontend
([ADR-009](ADR-009-react-typescript-and-spring-bff.md)), a command-line client
([ADR-026](ADR-026-cli-is-a-client-of-the-api.md)), and automation — all of which
need one stable, machine-callable contract.

## Decision

**`apps/api` is an executable Spring Boot HTTP application and the single
composition root.** It owns:

- HTTP routing, and the translation between contract DTOs and domain values;
- JSON serialization, and RFC 9457 Problem Details for every error, with a
  stable `code` and a `correlationId`;
- the one switch that maps a `ProblemKind` to an HTTP status;
- serving the hand-maintained OpenAPI document (`/v3/api-docs.yaml`) and a
  Swagger UI over it for development;
- health endpoints;
- authentication and authorization ([ADR-011](ADR-011-jwt-resource-server-and-roles.md));
- Spring configuration and the wiring of adapters into flows.

It depends on `core`, `adapter-persistence` and `adapter-jvm`. No module declares
a runtime dependency on `api`: the BFF and the CLI reach it over HTTP, and the
contract — not the module — is the coupling
([ADR-012](ADR-012-generated-contracts-and-remote-frontend-state.md)).

**Controllers translate; they do not decide.** A controller turns a request into
a flow call and the flow's result or `ApplicationProblem` into a response.
Validation of business rules, state transitions and uniqueness live in `core`,
outside controllers and outside Spring types.

**Spring stays in `apps/`.** Spring dependencies and annotations are prohibited
in `core`, enforced by [ADR-003](ADR-003-core-dependency-exclusions.md)'s rule.

**One inbound protocol.** HTTP is the only way into the application. A second
protocol — gRPC, a message consumer, a scheduled batch entry point — is not
introduced without revisiting this record.

## Rationale

HTTP lets every caller share one contract, with one place where authentication,
authorization, error shape and correlation are applied. Spring Boot is
appropriate at this boundary because it supplies the HTTP lifecycle,
configuration, health, packaging, security and mature contract tooling in one
dependency set. Confining it to `apps/api` keeps framework convenience from
becoming a domain dependency, which is what lets `core` stay testable with no
context.

A single composition root makes behavioural consistency a property of the
structure. Two roots invoking the same flows must stay consistent by discipline,
and "must" is not a mechanism: each root accumulates its own validation, its own
defaults and its own identifier vocabulary, and the divergence is found by users
rather than by tests. A caller that reaches the application only through its
contract cannot diverge from it, because it has nothing to diverge with.

One inbound protocol keeps the cross-cutting concerns in one place. A second
protocol duplicates authentication, error mapping and correlation, and each
duplicate is a place for the two to disagree.

## Alternatives considered

### A CLI as the only inbound adapter — rejected

The simplest deployment: no server to run, trivially scriptable. Rejected
because it offers no shared contract for a browser front end or for automation,
and no single place to apply authentication.

### A CLI as a second composition root beside the API — rejected

Lets the command line run with no server. Rejected because two roots over the
same flows drift apart, and every mechanism proposed to keep them aligned —
shared services, shared persistence, a lease to serialise execution — addresses
only part of the drift. [ADR-026](ADR-026-cli-is-a-client-of-the-api.md) makes
the CLI a client of this API instead.

### Spring annotations in `core` — rejected

Reduces wiring code. Rejected because it reverses the dependency rule that lets
`core` run from tests and any future entry point without Spring, and because
[ADR-003](ADR-003-core-dependency-exclusions.md) fails the build for it.

### A separate worker service or message broker now — rejected

Prepares for horizontal scale and long-running work. Rejected under
[ADR-005](ADR-005-abstractions-for-a-current-use-case.md): it requires remote
dispatch, delivery semantics and deployment infrastructure before there is a use
case that needs them. Work that must run off the request thread uses `@Async`
through an executor carrying `MdcTaskDecorator`
([ADR-016](ADR-016-one-logging-story-and-a-silent-core.md)).

## Consequences

### Positive

- Every caller receives one stable, machine-callable boundary, with one error
  shape and one security model.
- HTTP concerns stay replaceable and do not enter the domain.
- The server exposes health, the OpenAPI document and an executable artifact
  without any change to `core`.
- Consistency between callers holds by construction: there is one
  implementation of each behaviour.

### Negative

- The project carries Spring Boot's dependency tree and server lifecycle.
- Every client needs a reachable API. The CLI cannot work offline beyond what it
  can decide locally ([ADR-026](ADR-026-cli-is-a-client-of-the-api.md)).
- Cross-cutting behaviour — security, problem mapping, correlation — is Spring
  configuration, so testing it needs a Spring context rather than a plain unit
  test.
- The one-protocol rule means an integration that would be most natural as a
  message consumer must either call HTTP or reopen this record.
