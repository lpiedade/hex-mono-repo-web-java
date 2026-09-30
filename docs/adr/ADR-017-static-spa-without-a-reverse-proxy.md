# ADR-017: The SPA is static assets, with no reverse proxy of its own

- Status: Accepted
- Date: Template baseline
- Related: [ADR-009](ADR-009-react-typescript-and-spring-bff.md),
  [ADR-010](ADR-010-oidc-server-side-session-and-browser-security.md),
  [ADR-014](ADR-014-real-service-browser-acceptance.md),
  [ADR-019](ADR-019-coverage-ratchet-not-a-target.md),
  [ADR-025](ADR-025-aws-deployment-topology.md)

## Context

The portal is two artefacts shipped as one deliverable
([ADR-009](ADR-009-react-typescript-and-spring-bff.md)): a React SPA built by
Vite under `portal/web`, and a Spring Boot BFF under `portal/bff` that owns the
server-side routes `/app/bff/**`, `/app/health` and `/app/about`. Something has
to serve the SPA's files, and the browser has to reach both halves.

The property that matters is **one origin.** The BFF keeps the user's tokens in
a server-side session and the browser holds only a session cookie; CSRF
protection reads an `XSRF-TOKEN` cookie back as an `X-XSRF-TOKEN` header
([ADR-010](ADR-010-oidc-server-side-session-and-browser-security.md)). Both
work without configuration when the page and the BFF share an origin, and both
need CORS, credentialed cross-origin requests and cookie-scope decisions when
they do not.

The usual ways to get one origin each add a component whose only job is to put
the SPA and the BFF behind the same host: the BFF serving the SPA from its jar,
or a web-server container (nginx or similar) in front of both. The template
already has an edge in every environment that can do that job — CloudFront in
AWS, the Vite server on a developer's machine and in browser tests — so the
question is whether a third serving component earns its place.

## Decision

**The SPA is plain static assets and has no reverse proxy of its own.**
`vite build` writes `portal/web/dist/` with base path `/app/`; the BFF carries no
static resource handlers and serves no HTML; no web-server image is built for
the portal. The one-origin property is provided by the edge that already exists
in each environment:

| Environment | Serves `/app/*` (the SPA) | Routes `/app/bff/*`, `/app/health`, `/app/about` to the BFF |
| --- | --- | --- |
| AWS | CloudFront with an S3 origin | CloudFront, to the BFF origin behind the ALB ([ADR-025](ADR-025-aws-deployment-topology.md)) |
| Local development | Vite dev server (`npm run dev`) | The Vite proxy, to the BFF on `:8081` |
| Browser acceptance and e2e | `vite preview` over the built `dist/` | The same Vite proxy — `vite preview` reuses `server.proxy` ([ADR-014](ADR-014-real-service-browser-acceptance.md)) |

The proxy is declared once, in `portal/web/vite.config.ts`. `compose.yaml` runs
PostgreSQL, the API and the BFF only; the SPA is started beside it with Vite.

The serving rules every edge must honour:

- The BFF's routes are matched and forwarded before any fallback, so no
  client-side route can shadow the login entry point
  (`/app/bff/oauth2/authorization/oidc`) or the OIDC callback
  (`/app/bff/login/oauth2/code/oidc`).
- A missing hashed bundle under `/app/assets/` returns 404, never the SPA shell,
  so a stale URL fails honestly instead of loading HTML as JavaScript.
- Every other path under `/app/` falls back to `index.html`, so React Router
  owns client-side navigation.

**SPA client routes never share a first path segment with a BFF route.** The
edges forward by prefix, so a client route under `/app/bff`, `/app/health` or
`/app/about` would be sent to the BFF instead of the SPA. That is why the SPA's
build-information page is `/app/build`, not `/app/about`.

## Rationale

The origin is a security property before it is a deployment detail. Keeping the
page and the BFF on one origin lets the session cookie stay a first-party cookie
and the CSRF token stay a plain cookie read by same-origin script, with no
allow-list to maintain and none to get wrong.

Every environment the template targets already has a component that routes by
path in front of the browser. CloudFront has to exist in AWS for TLS, caching and
the WAF; the Vite server has to exist locally for hot reload. Each can serve the
static files and forward the BFF's prefixes, so a dedicated proxy would duplicate
routing that is already there. Serving static files from an object store and a
CDN is also what static files want: immutable hashed assets cached at the edge,
with no process to scale, patch or restart.

Keeping the BFF out of static serving keeps it what ADR-009 says it is — a thin
authenticated proxy — and keeps the frontend build out of Maven, so `npm run dev`
and `mvn verify` iterate independently.

## Alternatives considered

### An nginx container in front of the SPA and the BFF — rejected

The conventional container answer: one image serves `dist/` and proxies the
BFF's routes, giving one origin in any container runtime. Rejected because it is
an extra image, an extra configuration file and an extra network hop that add
nothing CloudFront and Vite do not already do in the environments the template
supports — and a third copy of the serving rules to keep in agreement with the
other two.

### The BFF serves the SPA from its jar — rejected

One origin with no extra component: `vite build` runs inside Maven's lifecycle
and the BFF serves the hashed assets through a custom resource resolver.
Rejected because it couples the two deploys — a CSS change ships a new JVM
image, and a BFF release redeploys the frontend — and ties static caching to the
JVM instead of the edge. It also puts static-serving semantics (which paths fall
back to `index.html`, which must 404) into Java inside a component meant to be a
thin proxy, and gates the frontend build on Maven.

### Serve the SPA from its own origin and add CORS to the BFF — rejected

Would let the SPA and the BFF be deployed with no shared front door. Rejected
because it widens the security surface — credentialed cross-origin requests, an
origin allow-list, cookie scope across hosts — to solve a problem one origin does
not have.

## Consequences

### Positive

- CORS is eliminated by topology in every supported environment: no policy, no
  `Access-Control-Allow-Origin` header, no allow-list.
- No web-server image to build, scan, configure or patch; the portal's only
  server-side artefact is the BFF.
- The BFF carries no static-file-serving code, and the frontend build is
  decoupled from Maven.
- In AWS, static assets are cached at the edge and cost no compute.

### Negative

- **A container-only deployment without CloudFront would need a proxy again.**
  Running the portal on a plain container host has no edge to provide one origin.
  If a project needs that, it adds a proxy then, by a new ADR that supersedes
  this one — rather than the template carrying one for a case it does not
  target.
- **The serving rules are implemented twice** — in the CloudFront distribution
  and its router function (`infra/terraform/02-platform/spa-router.js`), and in
  the Vite proxy — and nothing mechanical checks that they agree. The browser
  suites ([ADR-014](ADR-014-real-service-browser-acceptance.md)) exercise only
  the Vite side; the CloudFront side is proven in AWS.
- **Route naming is constrained.** A client route that reuses a BFF prefix
  breaks silently at the edge, not at build time. Reviewers must check new SPA
  routes against `/app/bff`, `/app/health` and `/app/about`.
- `mvn clean verify` does not build or test the frontend. CI runs a separate step
  in `portal/web` (`npm ci`, `npm run test:coverage`, `npm run build`), and its
  coverage is held by Vitest, not by Maven
  ([ADR-019](ADR-019-coverage-ratchet-not-a-target.md)). Forgetting that step
  means a broken frontend ships without a red Maven build.
- A BFF jar alone is not a portal: `portal/web/dist/` must be served by
  CloudFront + S3 or by Vite.
