# apps/api

The application API: a Spring Boot composition root that exposes `/api/v1` over
HTTP (ADR-007). It wires core's flows to the adapters, translates HTTP to and
from the contract, and owns security. It holds no domain logic.

## Layout (`com.example.app.api`)

| Package | Holds |
|---|---|
| `config` | `CoreConfig` (ports → adapters, flows as beans), properties, `@Async` with the MDC decorator |
| `security` | The two authentication modes and the shared authorization rules (`ApiAuthorization`) |
| `web` | Correlation ids, RFC 9457 Problem Details, the exception handler, the served contract, `/about`, `/user-context` |
| `item` | The example resource: `ItemController` and `ItemContracts` (domain ↔ contract) |
| `contract.model` | Generated from `openapi-v1.yaml` at build time — never edited, never used below `apps/` (ADR-012) |

## The contract comes first

`src/main/openapi/openapi-v1.yaml` is hand-written and authoritative. The
build generates the response models from it and copies it onto the classpath,
where `/v3/api-docs.yaml` and `/v3/api-docs` serve it verbatim.
`ContractPathsAreServedTest` fails when a declared path has no controller, and
`ContractPathNestingTest` when a path nests deeper than ADR-020 allows.

## Authentication (ADR-011)

| `app.auth.mode` | Verifies | Use |
|---|---|---|
| `jwt` (default) | Bearer JWTs from `APP_AUTH_ISSUER_URI`; roles from `APP_AUTH_ROLES_CLAIM` (default `roles`, dotted paths allowed) | Every deployed environment |
| `dev-token` | One pre-shared token (`APP_AUTH_DEV_TOKEN`) granting every role | Local development and tests; refused under the `prod` profile |

Reads need `READER`, writes `EDITOR` (`ApiAuthorization`). Health probes and the
contract are public. A refusal is a Problem Details body with a stable `code`
and the request's `correlationId`, never a stack trace.

## Running

```bash
# APP_DB_PASSWORD comes from your environment; never write it inline.
APP_AUTH_MODE=dev-token APP_AUTH_DEV_TOKEN=local \
  java -jar apps/api/target/api-0.1.0-SNAPSHOT-exec.jar
```

`infra/scripts/run-local.sh` does this for you, with the database. The `dev`
profile adds Swagger UI at `/swagger-ui.html`.

## Tests

| Suite | What it proves |
|---|---|
| `ItemsIT` | The example resource end to end: status codes, problems, validation |
| `PlatformIT` | Health, served contract, authentication, correlation ids, identity |
| `JwtModeIT` | The production mode with self-signed JWTs: roles, nested claims, expiry |
| `DevDataFixtureIT` | `infra/test-fixtures/dev-data` loads through the API |
| unit tests | Contract shape, JWT role mapping, startup guards, CORS, MDC propagation, log pattern |

The `*IT` suites boot the real application against a PostgreSQL Testcontainer
(ADR-006).
