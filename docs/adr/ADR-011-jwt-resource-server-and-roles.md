# ADR-011: JWT resource server with role-based access, plus a dev-token mode

- Status: Accepted
- Date: Template baseline
- Related: [ADR-002](ADR-002-layered-core-and-apps-boundary.md), [ADR-005](ADR-005-abstractions-for-a-current-use-case.md), [ADR-007](ADR-007-spring-boot-http-api-composition-root.md), [ADR-009](ADR-009-react-typescript-and-spring-bff.md), [ADR-010](ADR-010-oidc-server-side-session-and-browser-security.md), [ADR-026](ADR-026-cli-is-a-client-of-the-api.md)

## Context

The HTTP API is the one inbound boundary of the application: the portal reaches
it through the BFF ([ADR-009](ADR-009-react-typescript-and-spring-bff.md)) and
the CLI is a client of it over HTTP
([ADR-026](ADR-026-cli-is-a-client-of-the-api.md)). It must authenticate
callers and apply a small, stable set of authorization rules without the
application operating an identity provider. It must also be runnable locally
and in tests where no identity provider exists.

## Decision

The API has two authentication modes, selected by `app.auth.mode`.

### `jwt` (default)

- The API is a Spring Security OAuth2 resource server. It validates JWT bearer
  tokens issued by the provider at `APP_AUTH_ISSUER_URI`: signature against the
  provider's published keys, issuer, and temporal claims.
- Roles are read from one explicitly configured claim, `APP_AUTH_ROLES_CLAIM`
  (default `roles`), and mapped onto `AppRole`. They are never inferred from
  other claims. A value that is not an `AppRole` grants nothing.

### `dev-token`

- The API accepts one pre-shared bearer token, `APP_AUTH_DEV_TOKEN`, which
  grants all roles. It exists for local work, the BFF's `dev` mode
  ([ADR-010](ADR-010-oidc-server-side-session-and-browser-security.md)), and
  test stacks.
- Startup refuses `dev-token` mode under the `prod` profile.

### Roles and rules

`core` defines the roles as a domain type, `com.example.app.domain.security.AppRole`:

| Role | Grants |
| --- | --- |
| `READER` | every read |
| `EDITOR` | every write (create, update, delete) |
| `ADMIN` | reserved for administrative operations |

Roles are additive; a caller that needs to read and write carries both
`READER` and `EDITOR`. The rules are enforced in `apps/api` before a flow runs;
`core` names the roles but never reads a security context. Unauthenticated
requests get 401 and insufficient roles get 403, both as RFC 9457 Problem
Details with a stable `code` and the `correlationId`, and neither reveals
whether the target resource exists.

Clients send bearer tokens they obtained elsewhere. The CLI reads its token from
the environment and never echoes, logs, or persists it.

## Rationale

Resource-server JWT validation is mainstream, testable, and independent of any
particular identity provider: any provider that issues a signed JWT with a roles
claim works, and switching providers is configuration.

Three roles cover the read/write/administer split every application starts
with. A larger vocabulary is added when a use case needs it
([ADR-005](ADR-005-abstractions-for-a-current-use-case.md)).

Enforcing at the API edge is sufficient because the API is the only inbound
path: the BFF relays the user's token, and the CLI is an HTTP client, not a
second composition root. Keeping the role type in `core` lets a flow's
documentation and a test name what a caller needs, without `core` depending on
Spring Security.

A separate `dev-token` mode, refused under `prod`, makes local and test stacks
possible without a test issuer, and makes enabling it in production a startup
failure instead of a configuration mistake that goes unnoticed.

## Alternatives considered

### API keys — rejected

They identify a client, not a user, and carry no roles.

### Build an identity provider — rejected

Account lifecycle, login, MFA, and federation are platform responsibilities.

### Authorization checks inside `core` flows — rejected

`core` cannot depend on Spring Security, and with a single inbound boundary
there is no path that bypasses the API's checks. If a second inbound adapter is
ever added ([ADR-007](ADR-007-spring-boot-http-api-composition-root.md)), this
decision is revisited with it.

### A deterministic local token issuer instead of `dev-token` — rejected

It is closer to production but means running and maintaining a key pair and a
signing tool on every developer machine. A pre-shared token that production
refuses is simpler and no less safe.

### Attribute-based policy engine — rejected

Three roles do not justify another framework.

## Consequences

### Positive

- Caller identity and permissions are explicit and reproducible.
- The same validated claims work with any compliant identity provider.
- Local and test stacks run without an identity provider.
- A misconfigured production deployment fails at startup.

### Negative

- Operators must supply a trusted issuer and the correct roles claim.
- Role changes take effect only as tokens expire.
- `dev-token` grants everything; it must stay out of every environment that
  holds real data, and the `prod` profile guard is the only mechanical
  protection.
