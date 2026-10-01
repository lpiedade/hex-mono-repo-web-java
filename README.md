# App — Hexagonal Java Monorepo Template

A starting point for a web application with a hexagonal Java core, an HTTP API,
a command-line client and a React portal behind a backend-for-frontend. It ships
one example aggregate, `items`, carried through every layer, so every seam is
already wired and tested — replace it with your first real aggregate.

## Start a new project

```bash
./init-project.sh --group com.acme.orders --name orders --display "Orders"
```

It renames the Java package and groupId, the artifact and application names,
the CLI command, and the project name in compose, the scripts and Terraform,
and moves the source trees. `--dry-run` lists what would change. Then
`git init`, commit, and follow **Run it** below.

## What is in the box

| | |
|---|---|
| **Language / build** | Java 25, Maven multi-module (ADR-001) |
| **Core** | Hexagonal rings `domain` → `ports` ← `flows`, no framework, no I/O, no logging (ADR-002–004, ADR-016); enforced by the Maven enforcer and nightly ArchUnit (ADR-015) |
| **API** | Spring Boot 4, contract-first OpenAPI with generated models, RFC 9457 errors, correlation ids (ADR-007, ADR-012) |
| **Persistence** | PostgreSQL, Spring JDBC with explicit SQL, Flyway (ADR-008, ADR-021) |
| **Security** | API: JWT resource server with roles, or a dev token locally (ADR-011). Portal: OIDC login with server-side session and CSRF in the BFF (ADR-010) |
| **Portal** | React 18, TypeScript, MUI 5, React Query, i18n, WCAG 2.2 AA (ADR-009, ADR-013); a thin Spring Boot BFF proxy |
| **CLI** | picocli, generated HTTP client — a client of the API, not a second backend (ADR-026) |
| **Tests** | JUnit, Testcontainers (no silently skipped suite — ADR-006), Vitest, Playwright + axe against the real stack (ADR-014), coverage ratchet (ADR-019) |
| **Delivery** | GitHub Actions, Docker images for API and BFF, Terraform for AWS (EKS, RDS, CloudFront + S3 for the SPA — ADR-017, ADR-025) |
| **Process** | Specs with FR/AC ids, a feature register, issue and PR templates, labels as code, merge commits (ADR-018) |

## Layout

```
.
├── core/                    domain, ports, flows — the application itself
├── adapters/
│   ├── persistence/         PostgreSQL repositories + Flyway migrations
│   └── jvm/                 clock, ticker and id generator for the core's ports
├── apps/
│   ├── api/                 Spring Boot HTTP API (/api/v1) — the composition root
│   └── cli/                 command-line client of the API
├── portal/
│   ├── bff/                 Spring Boot backend-for-frontend (/app/bff)
│   └── web/                 React SPA (/app/)
├── docs/
│   ├── adr/                 architecture decision records
│   ├── arch/                contracts (api-layer/*.yaml), module map, security, data model
│   ├── spec/                functional specifications (FS-0XX, FR-###, AC-###)
│   ├── plans/               feature register and implementation plan
│   ├── dev/                 developer guides (local verification, portal, frontend standards)
│   └── performance/         coverage ratchet readings
├── infra/
│   ├── docker/              images for the API and the BFF
│   ├── scripts/             run / stop / seed locally, e2e, build-and-push, sync-labels
│   ├── terraform/           AWS: bootstrap, infrastructure, platform
│   └── test-fixtures/       synthetic development data, loaded through the API
├── .github/                 CI workflows, issue and PR templates, labels.yml
├── compose.yaml             PostgreSQL (+ API and BFF under the `app` profile)
├── CLAUDE.md                the rules, for humans and agents alike
├── CONTEXT.md               domain glossary
└── init-project.sh          renames the template for a new project
```

How the modules depend on each other, and how a request travels from the
browser to the database, is in [`docs/arch/module-dependency-map.md`](docs/arch/module-dependency-map.md).

## Run it

Prerequisites: JDK 25, Maven 3.9+, Node 20+, a Docker-compatible runtime.

```bash
cp .env.example .env                  # then set APP_DB_PASSWORD
infra/scripts/run-local.sh --seed     # PostgreSQL, API, BFF, Vite; loads the example data
```

| What | Where |
|---|---|
| Portal | <http://localhost:5173/app/> |
| API | <http://localhost:8080/api/v1> — Swagger UI at `/swagger-ui.html` (profile `dev`) |
| BFF | <http://localhost:8081/app/health> |
| PostgreSQL | `localhost:5432`, database and user `app` |

Locally the API runs in `dev-token` mode and the BFF in `dev` mode, with a token
generated per run (`.run/dev-token`, never committed). Stop with Ctrl-C, or
`infra/scripts/stop-local.sh` to stop the database too. Other ways to run —
containers, the browser journeys — are in [`infra/README.md`](infra/README.md).

```bash
java -jar apps/cli/target/cli-0.1.0-SNAPSHOT.jar items list --token "$(cat .run/dev-token)"
```

## Build and test

```bash
mvn clean verify                      # every Java module, unit + integration tests (needs Docker)
mvn verify -DskipITs                  # unit tests only
mvn -Parchitecture verify -pl core    # the ArchUnit ring report
```

```bash
cd portal/web
npm ci && npm run test:coverage && npm run build
npm run test:a11y                     # axe in a real browser, against the production build
```

Never pass `-T` to Maven here — see [`CLAUDE.md`](CLAUDE.md#validation).

## Adding a feature

1. Write or extend the spec in [`docs/spec/`](docs/spec/README.md) and register
   the feature in [`docs/plans/feature-register.md`](docs/plans/feature-register.md).
2. Open issues from the templates in `.github/ISSUE_TEMPLATE/`.
3. Change the contract first — `docs/arch/api-layer/openapi-v1.yaml`, and
   `portal-api-v1.yaml` if the browser needs it.
4. `core`: domain → port → flow, tested with fakes of the ports.
5. `adapters/persistence`: a migration and the repository, with an `*IT`.
6. `apps/api`: wire the flow in `CoreConfig`, add the controller, declare the
   roles in `ApiAuthorization`.
7. `portal/web`: the page, following [`docs/dev/frontend-standards.md`](docs/dev/frontend-standards.md).
8. Record any decision worth keeping as an ADR from
   [`docs/adr/ADR-000-template.md`](docs/adr/ADR-000-template.md).

## Deploy

`infra/scripts/build-and-push.sh` builds and pushes the images and uploads the
SPA; [`infra/terraform/README.md`](infra/terraform/README.md) is the runbook for
AWS.

## Conventions

[`CLAUDE.md`](CLAUDE.md) holds the architecture rules, commit and merge
conventions, the issue structure and the label table;
[`portal/CLAUDE.md`](portal/CLAUDE.md) the portal's. The decisions behind them
are in [`docs/adr/`](docs/adr/README.md).
