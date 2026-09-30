# ADR-009: React, TypeScript, and a Spring Boot backend-for-frontend

- Status: Accepted
- Date: Template baseline
- Related: [ADR-002](ADR-002-layered-core-and-apps-boundary.md), [ADR-007](ADR-007-spring-boot-http-api-composition-root.md), [ADR-010](ADR-010-oidc-server-side-session-and-browser-security.md), [ADR-011](ADR-011-jwt-resource-server-and-roles.md), [ADR-012](ADR-012-generated-contracts-and-remote-frontend-state.md), [ADR-013](ADR-013-mui-wcag-22-aa-design-system.md), [ADR-017](ADR-017-static-spa-without-a-reverse-proxy.md), [ADR-025](ADR-025-aws-deployment-topology.md), [ADR-027](ADR-027-feature-sliced-design-for-the-spa.md)

## Context

The application needs a browser interface over its HTTP API: forms, tables,
navigation, and an interactive login. Business behaviour must not be duplicated
in a JavaScript client, and bearer tokens should not be exposed to browser code.
The API is a stateless bearer-token resource server
([ADR-011](ADR-011-jwt-resource-server-and-roles.md)) and should stay one.

## Decision

Create one Maven reactor module, `portal`, holding two halves that ship as one
deliverable:

- `portal/web` — a React 18 / TypeScript single-page application built with
  Vite, served under the base path `/app/`. Material UI supplies the component
  foundation ([ADR-013](ADR-013-mui-wcag-22-aa-design-system.md)).
- `portal/bff` — a Spring Boot backend-for-frontend (package
  `com.example.app.portal`, port 8081) that owns `/app/bff/**`, `/app/health`,
  and `/app/about`.

The browser calls only the BFF, on the same origin as the SPA. The BFF owns the
interactive login and the browser session, CSRF, and the relay of the user's
access token to the API ([ADR-010](ADR-010-oidc-server-side-session-and-browser-security.md)).
Beyond that it is a thin authenticated proxy: it strips `/app/bff/v1` and
forwards the rest of the path to the API's `/api/v1`, reshaping nothing. Its
contract, `portal-api-v1.yaml`, references the API's schemas instead of
restating them ([ADR-012](ADR-012-generated-contracts-and-remote-frontend-state.md)).
When the API is unreachable the BFF answers 503 with its own Problem
(`UPSTREAM_UNAVAILABLE`) rather than a proxy error page.

The BFF persists no business state, opens no connection to the application
database, and makes no business decision. `portal` does not depend on `core`;
the API remains the authority for every validation, authorization decision, and
mutation.

The SPA's static bundle is not served by the BFF, and it has no reverse proxy of
its own ([ADR-017](ADR-017-static-spa-without-a-reverse-proxy.md)). In AWS,
CloudFront serves it from S3 and routes the BFF's paths to the BFF
([ADR-025](ADR-025-aws-deployment-topology.md)); locally and in browser tests,
the Vite dev server or `vite preview` serves it and proxies `/app/bff`,
`/app/health` and `/app/about` to `:8081`.

## Rationale

React, TypeScript, and Vite are a mainstream, focused stack for a data-heavy
internal SPA. A Spring BFF reuses the project's Java and Spring operational
baseline, and it is the one place in the browser path that can hold tokens
outside JavaScript. Keeping both halves in one module makes the presentation
boundary obvious and keeps it out of `core` and the API.

A proxy that reshapes nothing is cheap to keep correct: a new API operation
reaches the browser by declaring its path in the portal contract, not by writing
a BFF endpoint that could drift from the API it wraps.

## Alternatives considered

### SPA calls the API directly with bearer tokens — rejected

It puts tokens in browser storage or memory reachable by script, and it forces
the API to handle CORS and browser-oriented concerns it otherwise never sees.

### Next.js or another full-stack JavaScript framework — rejected

The application backend already exists. A second server-side stack would
duplicate responsibilities and add a runtime the team does not otherwise run.

### Serve the portal from the API module — rejected

Mixing cookie-session browser security with a stateless resource server blurs
the trust boundary and forces both to deploy and scale together.

### A BFF that composes and reshapes responses — rejected

Per-screen aggregation endpoints make the BFF a second API with its own
behaviour to test and version. The SPA composes what it needs from the API's
resources; the BFF adds authentication and nothing else.

## Consequences

### Positive

- Bearer tokens remain server-side.
- Frontend concerns are isolated from `core` and from API behaviour.
- Browser and API security boundaries are explicit and separately testable.
- Both halves live, version, and ship together, so a contract change and the
  screen that uses it land in one change.

### Negative

- The BFF is an additional runtime process.
- Frontend and Java toolchains must be maintained together.
- In-memory sessions are lost on restart, and more than one BFF replica needs
  sticky sessions or a shared session store such as Spring Session.
- Every API change the browser should see still needs a line in the portal
  contract.
