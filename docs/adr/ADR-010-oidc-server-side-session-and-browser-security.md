# ADR-010: OIDC server-side sessions and browser security

- Status: Accepted
- Date: Template baseline
- Related: [ADR-009](ADR-009-react-typescript-and-spring-bff.md), [ADR-011](ADR-011-jwt-resource-server-and-roles.md), [ADR-017](ADR-017-static-spa-without-a-reverse-proxy.md), [ADR-025](ADR-025-aws-deployment-topology.md)

## Context

The API is a stateless JWT resource server
([ADR-011](ADR-011-jwt-resource-server-and-roles.md)). The portal needs an
interactive browser login without the application building user accounts or an
identity provider, and without handing bearer tokens to JavaScript. It also
needs protection against CSRF, session fixation, and open redirects, and a way
to run locally without an identity provider at all.

## Decision

The BFF has two authentication modes, selected by `app.bff.auth.mode`.

### `oidc` (default)

- The BFF logs users in with Spring Security `oauth2Login` against an external
  OIDC provider, using the Authorization Code flow. Spring Security performs
  the protocol validation (state, nonce, issuer, signature, temporal claims);
  the application adds none of its own.
- Login starts at `/app/bff/oauth2/authorization/oidc`; the provider redirects
  back to `/app/bff/login/oauth2/code/oidc`. Logout is `POST /app/bff/logout`,
  which invalidates the session.
- Access, ID, and any refresh tokens are kept only in the server-side
  `HttpSession`. The browser holds only the session cookie, which is opaque to
  it.
- Every state-changing browser request carries CSRF protection: the BFF issues
  an `XSRF-TOKEN` cookie and requires it back in the `X-XSRF-TOKEN` header. The
  SPA's HTTP client does this for every mutation.
- On each proxied call the BFF relays the user's access token to the API as a
  bearer token. The API authenticates and authorizes that token itself; the BFF
  makes no authorization decision.
- A proxied call with no session is refused by the BFF with `401` and code
  `SESSION_REQUIRED`, and only that code sends the SPA to the login route. A
  `401` the API returns for a relayed token it refuses carries the API's own
  `UNAUTHENTICATED` and is shown as an error, not answered with a redirect: the
  user already has a session, so logging in again would hand back the same
  token and loop.
- Sessions are held in memory. More than one BFF replica needs sticky sessions
  at the load balancer or a shared session store such as Spring Session.

### `dev`

- No login. The BFF attaches the pre-shared `APP_AUTH_DEV_TOKEN` to every
  proxied call, which the API accepts only in its own `dev-token` mode
  ([ADR-011](ADR-011-jwt-resource-server-and-roles.md)). This mode exists so the
  full stack runs on a laptop or in a test environment without an identity
  provider; its protection against reaching production is the API's refusal to
  start `dev-token` under the `prod` profile.

### In both modes

- The SPA and the BFF are same-origin, so the browser never makes a cross-origin
  call and the BFF needs no CORS policy.
- UI visibility is not a control. Hiding a button for a role the user lacks is
  a convenience; the API's check on every request is the control.
- Outside local profiles, every hop — browser to edge, edge to BFF, BFF to API,
  BFF to identity provider — uses TLS with normal certificate and hostname
  validation.

## Rationale

The BFF pattern keeps credentials out of the browser while preserving the
stateless bearer API that every other client uses. Delegating the protocol to
Spring Security and identity to an external provider means the application owns
no password, no MFA, and no hand-written OIDC code. Same-origin access narrows
CSRF and CORS reasoning to one cookie on one origin.

Relaying the user's own token, rather than having the BFF call the API with a
service identity, keeps authorization where it is decided once: the API sees the
real user and the real roles.

The `dev` mode is a separate mode rather than a relaxed `oidc` configuration so
that nothing about the production path has to be weakened to make local work
possible.

## Alternatives considered

### Tokens in `localStorage` or `sessionStorage` — rejected

Any script running on the page, including a compromised dependency or a browser
extension, could read long-lived credentials.

### The API accepts the session cookie directly — rejected

It would make the API stateful, give it a CSRF surface, and split its
authentication model between browser and non-browser clients.

### Product-managed accounts — rejected

Identity lifecycle, MFA, and federation belong to the external provider.

### Disable CSRF because the API uses bearer tokens — rejected

The browser authenticates to the BFF with a cookie. A cookie-authenticated
mutation needs CSRF defence regardless of what the BFF sends upstream.

### The BFF calls the API with its own service credential — rejected

The API would see one identity for every user, and authorization would have to
move into the BFF.

## Consequences

### Positive

- Bearer credentials never enter JavaScript.
- API authentication stays identical for browser, CLI, and any other client.
- Login and session controls have one explicit owner.
- The full stack runs locally without an identity provider.

### Negative

- The BFF must retain tokens securely and refresh them.
- A BFF restart logs every user out.
- Horizontal scaling of the BFF needs sticky sessions or a shared session store.
- Keeping tokens out of JavaScript does not keep data out of the browser.
  Rendered values live in the page's memory, and the back/forward cache can
  restore a page after logout. A view that shows sensitive data must opt out of
  that cache or revalidate before painting; `Cache-Control: no-store` on API
  responses does not prevent it.
- A server-side session is revocable in principle but, with in-memory sessions
  and no administrative termination path, a user whose access is withdrawn at
  the provider keeps working until the relayed access token expires or its
  refresh fails. That window is bounded by token lifetime, not by a control.
