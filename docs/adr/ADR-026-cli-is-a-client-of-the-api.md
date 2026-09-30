# ADR-026: The CLI is a client of the API, not a second composition root

- Status: Accepted
- Date: Template baseline
- Related: [ADR-002](ADR-002-layered-core-and-apps-boundary.md),
  [ADR-007](ADR-007-spring-boot-http-api-composition-root.md),
  [ADR-009](ADR-009-react-typescript-and-spring-bff.md),
  [ADR-011](ADR-011-jwt-resource-server-and-roles.md),
  [ADR-012](ADR-012-generated-contracts-and-remote-frontend-state.md),
  [ADR-015](ADR-015-archunit-nightly-ring-report.md),
  [ADR-016](ADR-016-one-logging-story-and-a-silent-core.md),
  [ADR-025](ADR-025-aws-deployment-topology.md)

## Context

A command-line tool beside an HTTP API has two possible shapes. It can be a
**second composition root**: depend on `core` and the runtime adapters, open
its own database connections, run migrations, and execute flows in its own
process. Or it can be a **client**: call the API over HTTP and present what
comes back.

The first shape is the natural one when the CLI is the first inbound adapter
and there is no server to call. It stops being natural once the API exists,
and its cost is specific:

- **Two composition roots must stay behaviourally consistent, and "must" is not
  a mechanism.** Each root wires the same flows to the same ports, but each
  also validates its own input, translates its own errors and chooses its own
  defaults. Every one of those is a place where one root accepts what the
  other refuses, or writes a value in a vocabulary the other does not read. No
  test can assert that two implementations of an unwritten contract agree, so
  this class of defect is found in behaviour, not in the build.
- **Two processes writing one store need coordination.** Anything the API
  serialises — a worker draining a queue, a check-then-write under a
  transaction, a background job — becomes a distributed problem the moment a
  second process can do the same work. The fix on that path is a lease or a
  lock protocol with expiry semantics, written to stop two processes that
  should not both act from both acting.
- **The CLI carries the server's secrets.** A root that opens a database
  connection needs a database credential on the operator's machine, and needs
  to own a migration history it has no business running.

The portal already shows the other shape working. `portal/bff` talks to
`apps/api` over HTTP, declares no dependency on `core`, and proves it with a
`maven-enforcer-plugin` `bannedDependencies` rule
([ADR-009](ADR-009-react-typescript-and-spring-bff.md)). It cannot diverge
from the API, because it has nothing to diverge with.

## Decision

1. **`apps/cli` declares no dependency on `core`, on any `adapters/` module, or
   on `apps/api`, and opens no database connection.** A `bannedDependencies`
   enforcer rule in `apps/cli/pom.xml` fails `mvn validate` if any of them
   returns. It is modelled on `portal/pom.xml`'s rule and is non-transitive
   (`searchTransitive=false`) for the same reason: a test-scoped dependency
   used by a real-service integration test may still bring `core` onto the
   *test* classpath. What the rule guards is the shipped module's own
   declarations.
2. **Every command that needs application behaviour issues an HTTP request to
   `apps/api`.** The CLI presents results and maps them to exit codes; it
   computes nothing the API could compute. The API's base URL and the bearer
   token (`--api-url`, `--token`) are common options shared by every command
   that calls the API.
3. **The CLI generates its own client from `openapi-v1.yaml`.** It runs
   `openapi-generator-maven-plugin` against the same hand-maintained contract
   `apps/api` reads ([ADR-012](ADR-012-generated-contracts-and-remote-frontend-state.md)),
   into `com.example.app.cli.contract`. A Maven dependency on `apps/api` would
   drag Spring Boot into a picocli executable whose point is to start, do one
   thing and exit — and [ADR-007](ADR-007-spring-boot-http-api-composition-root.md)
   holds that no module depends on `api`. The contract is the coupling; the
   module is not.
4. **The CLI authenticates with a bearer token and holds no other secret.** It
   sends the token the API expects
   ([ADR-011](ADR-011-jwt-resource-server-and-roles.md)) and never a database
   credential — not by a validation rule, but because there is no longer a
   code path for one to travel in.
5. **The CLI's stdout is a contract.** Its `*IT` suites assert on it, so every
   log line goes to stderr, root at `WARN`
   ([ADR-016](ADR-016-one-logging-story-and-a-silent-core.md)). A command's
   output and its exit code are what a script depends on, and the CLI owns
   them.
6. **This bans a dependency, not local code.** `apps/cli` may hold its own
   types: an argument parser, an exit-code mapper, a console formatter are CLI
   concerns and stay in the module. What may not live there is a second
   implementation of anything the application decides.

## Rationale

**Consistency by construction is the only kind that holds.** A second root is
kept consistent by discipline, and discipline does not show up in the build.
A client is consistent because it has no logic of its own to disagree with —
the same argument that keeps the BFF from diverging, applied to a caller that
would otherwise be a full second execution path through `core`.

**One writer is a better answer than a coordination protocol.** Removing the
second process solves the concurrency problem with no lease, no fencing token
and no expiry semantics, and removes the failure mode where a lease holder
dies and the other process must decide how long to believe a stale lease. A
lease may still earn its place for horizontal scale of the API; it is not a
prerequisite for a correct single-instance deployment.

**The contract is a stricter coupling than the module.** A CLI generated from
`openapi-v1.yaml` in the same reactor build fails to compile when the contract
changes under it. Two composition roots give no such signal: the same
divergence compiles cleanly and is discovered by an operator.

**The objection — every command now needs a running server — is cheaper than
it looks.** A CLI that is a second root already refuses to run without
infrastructure: it needs a reachable, migrated database. This decision changes
which infrastructure, from a database the operator must also migrate to a
service that owns its own schema.

## Alternatives considered

### Keep the CLI as a second composition root, and coordinate the two — rejected

Depend on `core` and the adapters as before, and add the lease or lock that
lets two processes share a store safely. It would close the concurrency hole.
Rejected because coordination serialises two implementations; it does not make
them agree. Every divergence in validation, error translation and defaults
survives it untouched, and the operator still holds a database credential.

### Depend on `apps/api` for the request and response types — rejected

One set of types, no generation step. Rejected because it pulls Spring Boot
and the whole server classpath into the CLI's fat jar to obtain DTOs, and
breaks the rule that no module depends on `api`. Generating from the contract
gives the same types without the server.

### Move the commands into `apps/api` and ship a thin shell wrapper — rejected

One artefact, no client generation. Rejected because a CLI is not a deployment
of the server: it runs on an operator's machine against a remote environment,
and packaging the server to obtain a command-line entry point inverts the
`apps/` boundary ([ADR-002](ADR-002-layered-core-and-apps-boundary.md)).

### Remove the CLI and let the portal be the only client — rejected

The portal covers what a person does interactively. Scriptability is a
separate need — stable exit codes, non-interactive behaviour, and a
machine-readable stdout for automation — and removing the module would be a
product decision wearing an architecture decision's clothes.

### Ban the dependency with an ArchUnit rule instead of the enforcer — rejected

Consistent with the ring rules. Rejected because the ArchUnit suite is a
nightly report that blocks no pull request
([ADR-015](ADR-015-archunit-nightly-ring-report.md)), and a module boundary a
POM can restore in one line needs a gate, not an instrument. The enforcer
fails `mvn validate`, which is what `portal` already relies on.

## Consequences

### Positive

- **The divergence class closes rather than shrinking.** "The CLI does X, the
  API does Y" cannot be asked when there is one implementation.
- **No second writer exists**, so nothing needs to arbitrate between two.
- **No database credential leaves the server.** The operator's machine holds a
  bearer token and nothing else.
- **The CLI's build is a picocli fat jar with a generated client.** No JDBC
  drivers, no Flyway, no Spring on its classpath, and no service-loader shading
  concerns that come with them.
- **A new endpoint is a new typed call.** Regenerating the client from the
  contract is all the CLI needs before a command can use it.

### Negative

- **Every command that calls the API needs a reachable API.** An operator with
  no route to an environment can run only what needs no server. The honest
  mitigation is the local development stack, not a fallback path — a fallback
  that reaches the database directly is the second composition root under
  another name. On AWS the API is cluster-internal, so the CLI needs a route
  into the cluster until a project chooses to expose `/api/*` at the edge
  ([ADR-025](ADR-025-aws-deployment-topology.md)).
- **A network failure is a new failure mode.** It needs an exit code of its
  own, distinct from a usage or configuration error, rather than reusing one
  and leaving a script unable to tell "you called it wrong" from "the server
  was not there".
- **The CLI acquires the API's authentication problem.** In `jwt` mode an
  operator needs a token from the identity provider the API trusts; the
  `dev-token` mode serves local development only. Scripting against a secured
  environment depends on how tokens are issued there.
- **The CLI's integration tests need a running API.** Its `*IT` suites start
  the real service rather than a database, which is what the non-transitive
  enforcer rule makes room for.
