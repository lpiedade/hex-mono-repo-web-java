# Development guidance

## Architecture

The rules below are a summary. The reasoning, the rejected alternatives, and the
accepted trade-offs live in [`docs/adr/`](docs/adr/) — read the relevant ADR
before changing anything these rules cover, and update it if a decision changes.
[ADR-002](docs/adr/ADR-002-layered-core-and-apps-boundary.md) is the record of
the overall style; start there. Domain vocabulary lives in
[`CONTEXT.md`](CONTEXT.md).

### Layout

- Anything with a `main` lives under `apps/` (`apps/api`, `apps/cli`). `core` and
  `adapters` are libraries. `portal` is the one exception — `portal/web` (React)
  and `portal/bff` (Spring Boot) ship as one deliverable.
  ([ADR-002](docs/adr/ADR-002-layered-core-and-apps-boundary.md))
- Dependencies point toward `core`.
  ([ADR-002](docs/adr/ADR-002-layered-core-and-apps-boundary.md))
- `items` is the template's example aggregate, carried through every layer.
  Replace it with the project's first real aggregate rather than building beside
  it; `init-project.sh` renames the packages and artifacts.

### Inside `core`

- `core` is three package rings under `com.example.app`:
  `domain` (entities, value objects, enums, exceptions, stateless policies),
  `flows` (use cases), and `ports` (outbound interfaces plus the DTOs that are a
  port's own vocabulary). Dependencies run `flows → ports → domain`; `domain`
  depends on nothing. Each ring subdivides by subdomain — no class lives in a
  ring's root package.
  ([ADR-002](docs/adr/ADR-002-layered-core-and-apps-boundary.md))
- `core` must remain independent of Spring, database-vendor drivers, cloud SDKs,
  and orchestration frameworks. Enforced by `maven-enforcer-plugin`; a banned
  dependency fails `mvn validate`.
  ([ADR-003](docs/adr/ADR-003-core-dependency-exclusions.md))
- **`core` must not touch I/O.** The enforcer cannot see this: `java.nio.file` is
  a JDK package. Reading or writing a file, opening a socket, or holding a
  connection goes behind a port with an adapter. `core/src/main` references
  `java.nio.file` nowhere — keep it that way.
  ([ADR-004](docs/adr/ADR-004-core-touches-no-io.md))
- **`core` reads no clock and invents no identifier.** Time and ids come from
  `ports.time.TimeSource` / `Ticker` and `ports.identity.IdGenerator`, bound to
  the JVM in `adapters/jvm`, so every flow is deterministic under test.
  ([ADR-015](docs/adr/ADR-015-archunit-nightly-ring-report.md) rule 8)
- Prefer immutable domain values and deterministic ordering.
- A domain refusal is an exception extending `domain.error.ProblemException`,
  carrying an `ApplicationProblem` (kind, stable code, safe text). The inbound
  adapter maps the kind to a status or an exit code; `core` never names one.
- **`core` writes no logs.** No `System.Logger`, no slf4j, no `System.out`. A flow
  that observes something worth reporting returns it and the hosting application
  logs it. Enforced twice, because `bannedDependencies` cannot see a JDK package:
  a logging artifact fails `mvn validate`, and so does a logging import in
  `core/src/main`.
  ([ADR-016](docs/adr/ADR-016-one-logging-story-and-a-silent-core.md))
- **The rings are checked nightly, not by `mvn verify`.** Seven ArchUnit rules
  cover the ring directions, subdomain packaging, what `ports` may hold, cycles
  between subdomains, resource opening, and reading the clock or inventing an
  identifier. Run them yourself with `mvn -Parchitecture verify`; they are an
  instrument and block no pull request.
  ([ADR-015](docs/adr/ADR-015-archunit-nightly-ring-report.md))
  - **It reads bytecode, so its coverage is narrower than the prose above.** An
    import kept only for a Javadoc `{@link}` leaves no trace in the constant
    pool. Do not read a green report as proof that the rings are honoured
    everywhere.
  - Every rule starts green and `core/archunit_store/` does not exist. Freezing a
    rule's violations as accepted debt is deliberate and arrives as a committed
    diff — see `core/src/test/resources/archunit.properties`.
  - Rule **7** is absent by design: that `core` carries no logging API is
    ADR-016's, and its number is left as a gap so the set is not renumbered.
  - `ArchitectureTest.everyRuleCanFail()` runs each rule against planted
    fixtures; a rule that cannot be shown to fire does not ship.

### Contracts and persistence

- **The contract comes first.** `apps/api/src/main/openapi/openapi-v1.yaml`
  (the API) and `portal/bff/src/main/openapi/portal-api-v1.yaml` (browser →
  BFF) are hand-written and authoritative; server models, the CLI client and
  the SPA's types are generated from them. Change the contract, regenerate,
  then follow the compiler.
  ([ADR-012](docs/adr/ADR-012-generated-contracts-and-remote-frontend-state.md))
  - `ContractPathsAreServedTest` fails when the API contract declares a path no
    controller maps; `BffContractParityTest` when the portal contract proxies an
    operation the API contract does not declare.
- **`docs/` is never a build input.** No POM, npm script, test or import reads
  a file under `docs/`; a file the build reads lives in the module that owns
  it, which is why each contract sits beside the module that serves it.
  Nothing checks this — it is held in review. CI's docs-only skip counts only
  Markdown as docs, so a slip there still builds unless the file is `.md`.
  ([ADR-028](docs/adr/ADR-028-docs-is-never-a-build-input.md))
- **The path mirrors the aggregate root.** A resource with its own identity and
  an independent lifecycle is a top-level collection and names its relations in
  the body. A resource that cannot exist without its parent and has no
  identifier of its own is a nested singleton. Three sub-resource levels is the
  cap, counted by `ContractPathNestingTest`; namespace segments (`/admin`) do not
  count. No resource gets a second canonical URL for convenience — convenience
  is a query filter.
  ([ADR-020](docs/adr/ADR-020-resource-shape-and-url-nesting.md))
- A type from `com.example.app.api.contract.model` (generated from
  `openapi-v1.yaml`) may not appear below `apps/`. It is the truth of the wire,
  never of the domain or the database. Translate explicitly at the edge — see
  `ItemContracts`. This is already mechanical: the models are generated inside
  `apps/api`, and no module below `apps/` depends on `api`, so breaking it means
  adding a POM dependency, which is a reviewable change.
  ([ADR-012](docs/adr/ADR-012-generated-contracts-and-remote-frontend-state.md))
- Identifiers are UUIDs, generated by the flow through `IdGenerator`, never by
  the database. ([ADR-023](docs/adr/ADR-023-identifiers-are-uuids.md))
- SQL lives in `adapters/persistence`, together with the Flyway migrations for
  the schema it assumes — one stream per database, never an edited shipped
  migration (see `adapters/persistence/src/main/resources/db/CLAUDE.md`).
  Connectivity — datasource, pool, credentials — is assembled by the composition
  root and injected.
  ([ADR-008](docs/adr/ADR-008-postgresql-spring-jdbc-flyway.md),
  [ADR-021](docs/adr/ADR-021-one-migration-stream-and-one-baseline.md))
- A flow that needs several port calls to be one atomic decision takes the
  `UnitOfWork` port. It does not take a `@Transactional` annotation, which
  `core` cannot carry.

### Security

- The API verifies bearer JWTs from the configured issuer (`app.auth.mode=jwt`,
  the default) and maps a roles claim onto `AppRole`. `dev-token` mode is for
  local development and tests, and refuses to start under the `prod` profile.
  Which role each operation needs is declared once, in `ApiAuthorization`.
  ([ADR-011](docs/adr/ADR-011-jwt-resource-server-and-roles.md))
- The browser never holds a token. The BFF runs the OIDC login, keeps tokens in
  the server-side session, relays the access token to the API, and enforces
  CSRF (`app.bff.auth.mode=oidc`); `dev` mode is the local shortcut.
  ([ADR-010](docs/adr/ADR-010-oidc-server-side-session-and-browser-security.md))
- No secret is committed: tokens, passwords and client secrets come from the
  environment. The build's secret scan fails on a literal credential.

### Logging

- One facade: **slf4j**, everywhere except `core` (which is silent). A library
  (`adapters/*`) declares `slf4j-api` if it logs, and no binding; an app
  (`apps/api`, `apps/cli`, `portal`) declares the binding, because a composition
  root is the one place allowed to know its backend.
- The format is committed, not inherited. `logback-spring.xml` in `apps/api` and
  `portal/bff` prints `%X{correlationId}` — the whole reason those files exist —
  and includes none of Boot's logback defaults. `application.yml` carries levels
  and nothing else.
- **What gets a line** is fixed (ADR-016): one access line per request on the
  `…access` loggers, one audit line per successful write on
  `com.example.app.api.audit`, and the security events (401/403, CSRF
  refusals, logins, logouts, expired sessions). A line never carries a token, a
  cookie, a session id, or text a client typed: name entities by id, including
  in exception messages. The patterns neutralise CR/LF in the message; keep it
  that way.
- Work dispatched with `@Async` must go through an executor carrying
  `MdcTaskDecorator` (Boot's default executor does, via `AsyncConfig`), or it
  logs without a correlation id.
- The CLI's **stdout is a contract** its tests assert on. Every log line goes to
  stderr (`apps/cli/src/main/resources/logback.xml`), root at `WARN`.
  ([ADR-016](docs/adr/ADR-016-one-logging-story-and-a-silent-core.md))

### Scope

- Add abstractions only for a current use case. An input port per endpoint does
  not clear this bar.
  ([ADR-005](docs/adr/ADR-005-abstractions-for-a-current-use-case.md))
- The CLI is a client of the API, never a second composition root: it depends
  on no other module and reaches the application over HTTP.
  ([ADR-026](docs/adr/ADR-026-cli-is-a-client-of-the-api.md))
- Do not introduce a second inbound protocol without revisiting
  [ADR-007](docs/adr/ADR-007-spring-boot-http-api-composition-root.md).

## Validation

Run `mvn clean verify`. Integration tests require a Docker-compatible runtime;
a suite that skips because none is reachable fails the build rather than
passing silently ([ADR-006](docs/adr/ADR-006-testcontainers-for-integration-tests.md)).
`mvn verify -DskipITs` is the one sanctioned unit-only run.

**Never pass `-T` (parallel threads) to Maven in this project.** The
openapi-generator in `apps/api` and `apps/cli` has a race condition under
parallel builds: `test-compile` may start before the generator finishes
registering its output directory, producing spurious "cannot find symbol"
errors that disappear on a sequential re-run.

The SPA is a standalone npm project: from `portal/web`, run
`npm ci && npm run test:coverage && npm run build` (see
[`portal/CLAUDE.md`](portal/CLAUDE.md)).

The architecture rules are deliberately outside `mvn clean verify` — run them
with `mvn -Parchitecture verify`
([ADR-015](docs/adr/ADR-015-archunit-nightly-ring-report.md)). Adding a rule
there means adding it to `ArchitectureTest`, and its self-test fails unless the
rule can be shown to fire against the planted fixtures beside it.

Coverage is a per-module ratchet, not a target: a floor never goes above its
last measurement, and moving one is an edit to the POM (or `vite.config.ts`)
and to [`docs/performance/coverage-ratchet.md`](docs/performance/coverage-ratchet.md)
in the same change ([ADR-019](docs/adr/ADR-019-coverage-ratchet-not-a-target.md)).

`mvn clean verify` also lints every module's main-source Javadoc
(`maven-javadoc-plugin`, `javadoc-no-fork` at `verify`, warnings fail the
build). Everywhere, every comment present must be valid — HTML, `{@link}`
targets, `@param` names — under `doclint all,-missing`; `core` runs
`doclint all` at protected visibility, so its public API must also be fully
documented. The generated contract packages are excluded. A `core` ring root
(`domain`, `flows`, `ports`) gets no `package-info.java`: javac compiles it to
a class, and ArchUnit's rule 6 forbids any class in a ring's root package.

The `*IT` suites that drive the API over real HTTP are the safety net for any
move between modules: they exercise a subdomain end to end and should not need
editing when its classes change package.

## Git commit conventions

- Use Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- Subject ≤ 72 chars, imperative mood ("add" not "added").
- Body bullets explain *why*, not what — the diff shows the what.
- Wrap body at 72 cols.

### Attribution trailers

**No agent attribution trailer on anything this repository carries — not the
`Co-Authored-By: ...` line on a commit, and not a "Generated with ..." footer on
a pull request description or an issue body.** All three artefacts are named on
purpose: a rule that names only one leaves the others governed by nothing.

The enforcement is `"includeCoAuthoredBy": false` in Claude Code's user settings
(`~/.claude/settings.json`), which suppresses both trailers at the harness level
rather than relying on an agent reading this file. `.claude/` is git-ignored
here, so a repository-local settings file would bind nobody but the machine it
sits on.

### Merging a pull request

**Merge with a merge commit — `gh pr merge --merge`. Never `--squash`, never
`--rebase`.** Both of those rewrite the branch's SHAs
([ADR-018](docs/adr/ADR-018-merge-commits-not-squash.md)):

- **Work happens in several worktrees at once, and they stack.** Branches are
  cut from `main` *and from each other*, and a branch routinely merges `main`
  back in mid-flight. A squash replaces the branch's commits with one commit that
  shares no ancestry with them, so every derived branch re-applies a diff git
  already has, and the same conflicts resurface at each re-merge.
- **The conventions above are per-commit, and squash discards them.** Squash
  takes its message from the PR title and description, so the *why* bullets
  written for each commit are replaced by prose that never passed review as a
  commit message.
- **Traceability is per-commit too.** An issue's acceptance criteria each cite
  their `FR-###` / `AC-###`; one commit per criterion is what lets `git blame`
  and `git log -S` land on the commit whose body explains the decision.
- **The usual argument for squash — "one commit to revert" — already holds.**
  `git revert -m 1 <merge-sha>` undoes a merged PR in one command, and
  `git log --first-parent main` reads as one line per PR.

## Implementation issue conventions

Every implementation issue labelled `backend`, `frontend` or `infra` follows
[`.github/ISSUE_TEMPLATE/implementation.md`](.github/ISSUE_TEMPLATE/implementation.md),
so each acceptance criterion is traceable to the functional requirements it
satisfies. An epic follows `epic.md`, a defect `bug.md`; pull requests follow
[`.github/pull_request_template.md`](.github/pull_request_template.md).
Required sections of an implementation issue, in order:

- **Parent** — the originating spec (`FS-0XX`) and/or epic issue, plus the
  feature it delivers, from the
  [feature register](docs/plans/feature-register.md).
- **What to build** — one short paragraph on the capability.
- **Acceptance criteria** — `- [ ]` checkboxes grouped under **bold FR-area
  subheaders**; end every bullet with the `FR-###` (and `AC-###`) IDs it
  satisfies, in parentheses.
- **Normative coverage (FR / AC)** — the exact FR ranges and AC IDs the issue
  owns, listed per spec.
- **Prerequisite ADRs** — ADRs that must be `Accepted` before implementation
  (omit if none).
- **Blocked by** — the prerequisites this issue waits on, each as a **closable
  issue reference** written as a task-list item (`- [ ] #NN — <title>`) so
  GitHub tracks it natively and the `blocked` label automation can parse it.
  Never a free-text domain, spec, or gate description: if a whole domain or gate
  is the blocker, open (or reuse) a tracking issue and cite its `#NN`. Omit the
  section when there are no prerequisites.
- **Out of scope** — deferred behaviour named by its `FR-###` / `FS-0XX-F##`
  ID and MoSCoW tier, so an unselected obligation is never inferred.
- Do NOT add an attribution trailer — see **Attribution trailers** above.

Rules:

- Cite only `FR-###` IDs that exist in the referenced spec; never invent one.
  Prefer contiguous ranges that match the spec's section boundaries (each spec
  numbers its FRs from `FR-001`; see [`docs/spec/`](docs/spec/README.md)).
- Every acceptance-criterion bullet traces to at least one `FR-###`. When a
  criterion is set by a contract (`openapi-v1.yaml` / `portal-api-v1.yaml`
  path), an ADR, or the spec's Definition of Done instead of a single FR, cite
  that source explicitly.
- When revising an existing issue, preserve **Parent**, **What to build**, and
  its contract references verbatim.

### Labels

Labels are declared in [`.github/labels.yml`](.github/labels.yml) and applied by
`infra/scripts/sync-labels.sh` (and by `.github/workflows/labels.yaml` when the
file changes on `main`). The axes are orthogonal and may coexist on one issue.

| Label | Axis | Set by | Meaning |
|---|---|---|---|
| `backend` | Area | human | API, engine, adapter and persistence work |
| `frontend` | Area | human | React and BFF-frontend work |
| `infra` | Area | human | Build, CI, nightly lanes, ArchUnit, coverage ratchets, deployment |
| `must` | Priority | human | The feature's Tier in the [feature register](docs/plans/feature-register.md) is Must |
| `should` | Priority | human | … is Should |
| `could` | Priority | human | … is Could |
| `epic` | Granularity | human | Coarse epic worked through its **Decomposition**, never in one pass |
| `ready-for-agent` | Readiness | human | The spec is complete enough to implement, independent of dependency state |
| `blocked` | Dependency state | automation | An issue under **Blocked by** is still open — never set by hand |
| `bug` | Type | human | Behaviour differs from its spec, contract or ADR |

- **Priority is product-absolute.** Every implementation issue carries exactly
  one of `must` / `should` / `could`, taken from the feature's `Tier` in the
  feature register — never from an estimate, and never from how soon the work is
  scheduled. *What a feature is worth* is the register's; *when it is worked* is
  the [implementation plan](docs/plans/implementation-plan.md)'s. A `must` issue
  can sit in a late wave.
- **There is deliberately no `wont` label.** A Won't-tier feature gets no issue
  at all — that is what makes it a Won't — so an issue with no priority label
  means "not yet prioritised", never "outside the product". The Won't tier lives
  in the register and nowhere else. `sync-labels.sh --prune` removes GitHub's
  default `wontfix` for the same reason.
- **`epic` carries no title marker.** No `(epic)` / `[epic]` in the title — the
  label is the marker.
- **`blocked` is owned by** `.github/workflows/issue-blocked-labels.yaml`: present
  whenever any `#NN` under **Blocked by** is still open, removed once they all
  close.
- An issue is pickable now when it carries `ready-for-agent` and not `blocked`
  (`label:ready-for-agent -label:blocked`).
- `epic` + `ready-for-agent` means the spec is settled enough to act on: if the
  epic has no **Decomposition** yet, produce it; if it has one, pick up its
  tracer bullets. It never means "implement the whole thing in one pass".
  `epic` + `blocked` is valid — an epic tracks its own prerequisites through
  **Blocked by** like any other issue.
- A coarse epic lists a **Decomposition** checklist that splits it into
  `ready-for-agent` tracer bullets once its prerequisites exist. A child is
  picked and closed on its own; the epic closes when its checklist is done.
