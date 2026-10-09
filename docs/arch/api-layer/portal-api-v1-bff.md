# Portal BFF Design — portalApiVersion 1

- Status: Reference
- Machine-readable contract:
  [`portal-api-v1.yaml`](../../../portal/bff/src/main/openapi/portal-api-v1.yaml)
  — the authoritative OpenAPI 3.1 document the SPA's TypeScript types are
  generated from. It reuses the application API's schemas by `$ref` into
  [`openapi-v1.yaml`](../../../apps/api/src/main/openapi/openapi-v1.yaml); this
  document is the prose rationale, and the contract wins wherever the two
  disagree.
- Decisions: [ADR-009](../../adr/ADR-009-react-typescript-and-spring-bff.md),
  [ADR-010](../../adr/ADR-010-oidc-server-side-session-and-browser-security.md),
  [ADR-012](../../adr/ADR-012-generated-contracts-and-remote-frontend-state.md)
- Identity: [Identity and Authentication](../security/identity-and-authentication.md)

## 1. Purpose

The BFF (backend-for-frontend, `portal/bff`, package `com.example.app.portal`)
sits between the React SPA and the application API. It owns:

- the browser-to-server security boundary — the OIDC login, the server-side
  session that holds the tokens, and CSRF protection;
- forwarding each SPA call to the application API with the right bearer token;
- a stable, versioned URL surface for the SPA (`portalApiVersion`), independent
  of the application API's `schemaVersion`.

It owns **no business logic and no data**. It does not depend on `core`
(enforced by `ban-core-dependency`), aggregates nothing, reshapes nothing, and
does not serve the SPA's static files. The SPA is plain static assets with no
reverse proxy of its own: CloudFront (S3 origin) serves it in AWS, and the Vite
dev server or `vite preview` serves it locally and in browser tests
([ADR-017](../../adr/ADR-017-static-spa-without-a-reverse-proxy.md),
[ADR-025](../../adr/ADR-025-aws-deployment-topology.md)).

## 2. Base path and namespaces

The SPA and the BFF share one origin under `/app/`:

| Path | Owner | Purpose |
| --- | --- | --- |
| `/app/` and everything not below | SPA (the edge's static origin) | The SPA entry point and its hashed assets; unknown paths fall back to `index.html` for client-side routing |
| `/app/bff/v1/**` | BFF | Proxied API routes (portalApiVersion 1) |
| `/app/bff/oauth2/authorization/oidc` | BFF | Starts the OIDC login (`oidc` mode) |
| `/app/bff/login/oauth2/code/oidc` | BFF | OIDC redirect URI (callback) |
| `POST /app/bff/logout` | BFF | Ends the session; a no-op in `dev` mode |
| `/app/health` | BFF | Liveness — reports only that the BFF serves requests; it does not probe the API |
| `/app/about` | BFF | `portalApiVersion` and the BFF's build coordinates |

The edge in front of the browser — CloudFront in AWS, the Vite proxy
(`portal/web/vite.config.ts`) locally — must route every `/app/bff/`,
`/app/health` and `/app/about` request to the BFF *before* the SPA fallback
applies, or the login callback would be answered with `index.html`. For the same
reason no SPA client route may start with one of those segments: the SPA's
build-information page is `/app/build`, not `/app/about`.

## 3. Request flow

```text
Browser  ──  GET /app/bff/v1/items  (session cookie; X-XSRF-TOKEN on mutations)
   │
   ▼
BFF
   │  oidc: requires a session (else 401 SESSION_REQUIRED); checks CSRF on mutations
   │  strips /app/bff/v1, forwards to /api/v1
   │  adds  Authorization: Bearer <user access token | APP_AUTH_DEV_TOKEN>
   │  adds  X-Correlation-ID (propagated, or generated if absent)
   ▼
Application API  ──  GET /api/v1/items
   │
   ▼
BFF returns the API's status and body unchanged, plus the envelope headers (§5)
```

## 4. Route mapping

Every proxied route is a 1:1 mapping: the BFF path with `/app/bff/v1` replaced by
`/api/v1`. The authoritative per-operation mapping is the `x-proxies-to`
extension on each operation in
[`portal-api-v1.yaml`](../../../portal/bff/src/main/openapi/portal-api-v1.yaml).
`BffContractParityTest` fails the build when an `x-proxies-to` names an operation
that [`openapi-v1.yaml`](../../../apps/api/src/main/openapi/openapi-v1.yaml) does
not declare, so the BFF cannot
advertise a route the API does not serve.

The template's surface:

| BFF operation | Upstream |
| --- | --- |
| `GET /app/bff/v1/items` | `GET /api/v1/items` |
| `POST /app/bff/v1/items` | `POST /api/v1/items` |
| `GET /app/bff/v1/items/{itemId}` | `GET /api/v1/items/{itemId}` |
| `PUT /app/bff/v1/items/{itemId}` | `PUT /api/v1/items/{itemId}` |
| `DELETE /app/bff/v1/items/{itemId}` | `DELETE /api/v1/items/{itemId}` |
| `GET /app/bff/v1/user-context` | `GET /api/v1/user-context` |
| `GET /app/bff/v1/about` | `GET /api/v1/about` |

Do not hand-maintain a copy of this table as the surface grows; read it from the
contract.

**Adding an operation** is three edits: declare it in `openapi-v1.yaml` (and
serve it — `ContractPathsAreServedTest`), declare the BFF operation in
`portal-api-v1.yaml` with its `x-proxies-to` and `$ref`'d schemas, and regenerate
the SPA's types. The proxy itself needs no code change unless the operation needs
a header forwarded that the BFF does not already forward.

**When a screen needs a composed call** — data from two API operations in one
round trip — prefer two calls from the SPA through React Query. Composition in
the BFF is a deliberate exception: it makes the BFF a second place with logic,
and it breaks the `$ref` rule, because the composed body is no longer an API
body. Record it in an ADR if you need it.

## 5. Envelope

Every BFF response carries:

```text
X-Portal-Api-Version: 1
X-Correlation-ID: <propagated or generated>
```

The SPA checks `X-Portal-Api-Version` before parsing a body, so a deployment that
pairs an old SPA with a new BFF fails visibly rather than misreading a shape.
Request headers the API needs (`Content-Type`, `Accept`, and any precondition or
idempotency header an operation declares) are forwarded. The browser's cookies,
any `Authorization` header it sends, and hop-by-hop headers must not be: the BFF
is the only party that decides which bearer token reaches the API.

## 6. Authentication and CSRF

Summarized here; the full description is
[Identity and Authentication](../security/identity-and-authentication.md) §4.

| `app.bff.auth.mode` | Browser holds | Bearer token sent upstream | CSRF |
| --- | --- | --- | --- |
| `oidc` (default) | Session cookie only | The user's access token, from the server-side `HttpSession` | `XSRF-TOKEN` cookie, echoed in `X-XSRF-TOKEN` on every mutating request |
| `dev` | Nothing | `APP_AUTH_DEV_TOKEN` | Not enforced — no session to ride |

The BFF performs no authorization of its own. Every role check happens in the
API; the BFF's job is only to present the right identity.

## 7. Error translation

- **The API's Problem Details bodies are propagated unchanged**, with their
  status. A `400`, `403`, `404` or `409` from the API reaches the SPA exactly as
  the API wrote it — and so does a `401 UNAUTHENTICATED` from the API, which
  means the relayed token was refused.
- **`401 SESSION_REQUIRED`** (BFF-generated) when a proxied call arrives without
  a session in `oidc` mode. This is the only code that sends the SPA to the login
  route. The two `401`s carry different codes on purpose: redirecting on the
  API's `UNAUTHENTICATED` would log a user who already has a session in again,
  get the same token back, and loop.
- **`503 UPSTREAM_UNAVAILABLE`** (BFF-generated) when the API cannot be reached or
  does not answer in time. The body is the contract's `BffProblem`: `type`,
  `title`, `status`, `code`, `correlationId`, `portalApiVersion`.
- The BFF never emits a stack trace, an internal URL or an upstream exception
  message.

## 8. Operational notes

- **Sessions are in memory.** One replica needs nothing more; several need sticky
  sessions or Spring Session (see the identity document).
- **Timeouts.** Keep explicit connect and read timeouts on the upstream client,
  so a slow API turns into a `503` rather than a pile of held browser
  connections.
- **Logging.** `logback-spring.xml` prints `%X{correlationId}` on every line, and
  the same id travels to the API in `X-Correlation-ID`, so one browser action can
  be followed through both logs.
