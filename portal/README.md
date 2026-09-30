# Portal

The browser-facing deliverable: a React SPA ([`web/`](web/)) and the Spring
Boot 4 backend-for-frontend that serves it ([`bff/`](bff/)), shipped as one
unit under `/app` (ADR-009). The browser talks only to the BFF, on the same
origin; the BFF talks to the application API (`/api/v1`) over HTTP.

The portal does not depend on `core`. The API is the authority for every
validation, authorization and result; the portal renders what it answers.

## How a request travels

```
browser ──/app/bff/v1/**──▶ BFF ──/api/v1/** + Bearer token──▶ API
        ◀──── same body, same status, + X-Correlation-ID ─────
```

The BFF is a thin authenticated proxy. It strips `/app/bff/v1`, forwards to
`/api/v1`, and attaches the upstream bearer token itself — the browser never
holds one. It reshapes nothing, so every proxied body is the API's, which is
why [`portal-api-v1.yaml`](../docs/arch/api-layer/portal-api-v1.yaml) references
the schemas of [`openapi-v1.yaml`](../docs/arch/api-layer/openapi-v1.yaml)
instead of copying them. Every response carries `X-Portal-Api-Version` and
`X-Correlation-ID`; an unreachable API is a `503` Problem Details body with
code `UPSTREAM_UNAVAILABLE`, never a hang.

## Authentication (ADR-010)

Selected by `app.bff.auth.mode`:

| Mode | Behavior |
| --- | --- |
| `oidc` (default) | The BFF runs the OIDC authorization-code flow and keeps the tokens in a server-side session; the browser holds only the session cookie. A proxied call without a session answers `401` with code `SESSION_REQUIRED`, and the SPA navigates to `/app/bff/oauth2/authorization/oidc`. Mutating requests carry `X-XSRF-TOKEN`, copied from the `XSRF-TOKEN` cookie. |
| `dev` | No login. The BFF attaches a pre-shared dev token to every proxied call. Local development only. |

The SPA's side of this lives in `web/src/api/auth.ts`, and it asks nothing
about the mode: it reacts to what the BFF answers, so the same bundle serves
both. Sign-out is `POST /app/bff/logout` followed by a reload.

## Endpoints

| Method | Path | Served by |
| --- | --- | --- |
| `*` | `/app/bff/v1/**` | Proxy to `/api/v1/**`. |
| `POST` | `/app/bff/logout` | Ends the session (a no-op in `dev`). |
| `GET` | `/app/bff/oauth2/authorization/oidc` and the OIDC callback | The login flow (`oidc` mode). |
| `GET` | `/app/health` | BFF liveness; does not probe the API. |
| `GET` | `/app/about` | `portalApiVersion` and the BFF's build coordinates. |
| `GET` | `/app/` and client routes | The SPA; unknown paths fall back to `index.html`. |

Because the BFF owns `bff`, `about` and `health` under `/app`, no SPA route
may start with those segments.

## Code layout

- `bff/` — Spring Boot 4, packages under `com.example.app.portal`.
- `web/` — Vite project; see [`web/README.md`](web/README.md) for commands,
  routes and environment variables.

## Local development

1. Start the application API (see the repository root README).
2. Start the BFF in `dev` mode on port 8081, pointed at the API.
3. `npm --prefix portal/web install && npm --prefix portal/web run dev` — Vite
   serves the SPA with hot reload and proxies `/app/bff`, `/app/health` and
   `/app/about` to the BFF.

## Validation

- BFF: `mvn clean verify` from the repository root.
- SPA: from `portal/web/`, `npm ci && npm run test:coverage && npm run build`,
  then `npm run test:a11y` for the axe suite. The journey suite
  (`npm run test:journey`) needs a running stack at `E2E_BASE_URL` (ADR-014).
