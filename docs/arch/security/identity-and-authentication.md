# Identity and Authentication

- Status: Reference
- Decisions: [ADR-010](../../adr/ADR-010-oidc-server-side-session-and-browser-security.md)
  (browser and BFF), [ADR-011](../../adr/ADR-011-jwt-resource-server-and-roles.md)
  (API)
- Contracts: [`openapi-v1.yaml`](../api-layer/openapi-v1.yaml),
  [`portal-api-v1.yaml`](../api-layer/portal-api-v1.yaml)

## 1. Purpose

Who a caller is, how each tier learns it, and what each tier may do with it.
There are two authentication boundaries and each has two modes:

| Tier | Property | Default | Alternative |
| --- | --- | --- | --- |
| Application API (`apps/api`) | `app.auth.mode` | `jwt` | `dev-token` |
| Portal BFF (`portal/bff`) | `app.bff.auth.mode` | `oidc` | `dev` |

Every path, in every mode, ends in the same place: an `Authorization: Bearer`
header on a request to `/api/v1`. The modes differ only in where that token comes
from and how the API validates it.

## 2. Roles

Roles are `com.example.app.domain.security.AppRole`, a `core` enum, so flows can
reason about them without a framework type:

| Role | Grants |
| --- | --- |
| `READER` | Every read (`GET`) under `/api/v1` |
| `EDITOR` | Every write (`POST`, `PUT`, `PATCH`, `DELETE`) under `/api/v1` |
| `ADMIN` | Reserved for administrative operations; no template endpoint requires it |

Roles are independent grants, not a hierarchy: an editor who must also read
carries both `READER` and `EDITOR`. A request without a valid token answers `401`;
a valid token without the required role answers `403`. Both are Problem Details
bodies.

## 3. Application API

### 3.1 `jwt` mode (default)

The API is a Spring Security OAuth2 **resource server**. It validates each bearer
token as a JWT issued by `APP_AUTH_ISSUER_URI`: signature against the issuer's
JWKS, issuer, expiry and not-before. It does not call the identity provider per
request and holds no session.

- **Subject** — the token's `sub` claim.
- **Roles** — read from the claim named by `APP_AUTH_ROLES_CLAIM` (default
  `roles`). Values that match an `AppRole` name are granted; any other value is
  ignored. A missing claim grants no role, so the caller authenticates but is
  refused every operation.

Configure the identity provider to put the roles into the access token under
that claim — for example, a group-to-claim mapper in Keycloak or a custom claim in
Entra ID, Cognito or Auth0.

### 3.2 `dev-token` mode

For local development and automated tests only. The API accepts one pre-shared
bearer token, `APP_AUTH_DEV_TOKEN`, and grants the caller a fixed development
subject with **every** role. Any other bearer token is refused.

**Startup refuses this mode under the Spring profile `prod`.** A deployment
cannot enable it by accident: the application fails to start rather than serve
with a shared secret as its only control. The token itself is supplied through
the environment (a Git-ignored `.env` locally, a secret store elsewhere) and
never committed.

### 3.3 `GET /api/v1/user-context`

Answers who the API believes the caller is, in either mode:

```json
{
  "schemaVersion": 1,
  "subject": "<sub claim, or the development subject>",
  "roles": ["READER", "EDITOR"]
}
```

The SPA reads it through `GET /app/bff/v1/user-context` to decide what to show.
Hiding a control is a convenience; the API's `403` is the enforcement.

## 4. Portal BFF

### 4.1 `oidc` mode (default)

The BFF is an OAuth2 **client** using Spring Security `oauth2Login` (authorization
code flow).

1. The SPA calls a proxied route with no session; the BFF answers `401` with code
   `SESSION_REQUIRED`. Only this code triggers a login redirect: a `401` with the
   API's own code `UNAUTHENTICATED` means the API refused the relayed token, and
   logging in again would return the same token and loop, so the SPA shows it
   as an error instead.
2. The SPA navigates the browser to `/app/bff/oauth2/authorization/oidc`.
3. The BFF redirects to the identity provider; after login the provider redirects
   back to `/app/bff/login/oauth2/code/oidc`.
4. The BFF exchanges the code for tokens and keeps them in the **server-side
   `HttpSession`**. The browser receives only the session cookie (`HttpOnly`,
   `Secure`, `SameSite`), never a token.
5. On each proxied call the BFF attaches the user's access token as the bearer
   token to `/api/v1`, refreshing it when it has expired and a refresh token is
   available. The API validates it in `jwt` mode, exactly as it would a token from
   any other client.
6. `POST /app/bff/logout` invalidates the session.

**CSRF.** Because the session is cookie-borne, every mutating request must carry
the `X-XSRF-TOKEN` header, copied by the SPA from the `XSRF-TOKEN` cookie the BFF
sets (Spring Security's cookie CSRF token repository). A mutating request without
a matching header is refused with `403`.

**Sessions are in memory.** A single BFF replica needs nothing more. With more
than one replica, either route each browser to the same replica (sticky
sessions at the load balancer or ingress) or move the session store out of
process with Spring Session (for example JDBC on the application database, or
Redis). A restart of an in-memory replica logs its users out.

### 4.2 `dev` mode

No login. The BFF accepts every browser request and attaches `APP_AUTH_DEV_TOKEN`
as the bearer token on every proxied call; the API must run in `dev-token` mode
with the same value. There is no browser session and no per-user identity, so
this mode is for a developer's own machine only.

## 5. Mode combinations

| API | BFF | Use |
| --- | --- | --- |
| `jwt` | `oidc` | Every shared environment. The only combination for production |
| `dev-token` | `dev` | Local development and the browser acceptance suite |
| `dev-token` | — | CLI and `*IT` suites calling the API directly with the dev token |
| `jwt` | — | CLI against a real deployment, with a token obtained from the identity provider |
| `jwt` | `dev` | Invalid: the dev token is not a JWT, and the API refuses it |

## 6. Configuration reference

| Variable | Tier | Meaning |
| --- | --- | --- |
| `APP_AUTH_MODE` | API | `jwt` (default) or `dev-token` |
| `APP_AUTH_ISSUER_URI` | API | OIDC issuer whose JWTs the API accepts (`jwt` mode) |
| `APP_AUTH_ROLES_CLAIM` | API | Claim holding the roles; default `roles` |
| `APP_AUTH_DEV_TOKEN` | API, BFF | The pre-shared token (`dev-token` / `dev` modes). Never committed |
| `APP_BFF_AUTH_MODE` | BFF | `oidc` (default) or `dev` |
| OIDC client registration | BFF | Issuer, client id and client secret of the `oidc` registration, as standard `spring.security.oauth2.client.*` properties supplied through the environment |

The authoritative list, with defaults, is each application's `application.yml`
and the root `.env.example`.

## 7. What this document does not define

- The identity provider itself — any OIDC-compliant provider works.
- Fine-grained, per-resource authorization. Roles are global; a project that
  needs ownership or tenancy adds it in `core`, where a flow can decide it.
- Audit trails. A flow that must record who did something takes the subject as an
  argument; the template records `created_at` / `updated_at` only.
