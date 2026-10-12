# ADR-029: A pull request runs the checks its changes can reach; the nightly runs all of them

- Status: Accepted
- Date: 2026-10-12
- Related: [ADR-006](ADR-006-testcontainers-for-integration-tests.md), [ADR-012](ADR-012-generated-contracts-and-remote-frontend-state.md), [ADR-014](ADR-014-real-service-browser-acceptance.md), [ADR-028](ADR-028-docs-is-never-a-build-input.md)

## Context

`.github/workflows/build.yaml` runs every check in one job: the credential scan,
`mvn clean verify` (about a minute and a half), and the portal's lint, format,
typecheck, unit tests, build and accessibility suite (about two minutes with the
Playwright install). Until now the only narrowing was the docs-only skip
([ADR-028](ADR-028-docs-is-never-a-build-input.md)), so a pull request that
touched one file under `portal/web/` still waited for the whole Maven reactor,
and a Java-only change for the whole portal.

The two halves read almost nothing of each other. Outside `portal/web/`, the
SPA reads only the two OpenAPI contracts: it generates its types from
`portal-api-v1.yaml`, which `$ref`s `openapi-v1.yaml`, and `apiContract.test.ts`
reads the first. No Maven module and no Java test reads anything under
`portal/web/`. Nothing checks either fact.

## Decision

- **The scope step classifies each changed file of a pull request**, and the
  first matching row wins:

| Changed path | Checks it runs |
| --- | --- |
| `*.md`, `LICENSE`, `.github/ISSUE_TEMPLATE/*` | none (ADR-028) |
| `apps/api/src/main/openapi/*`, `portal/bff/src/main/openapi/*` | backend and frontend |
| `portal/web/*` | frontend |
| `pom.xml`, `core/pom.xml` | backend and the guard self-test |
| `core/*`, `adapters/*`, `apps/*`, `portal/pom.xml`, `portal/bff/*`, `infra/test-fixtures/*` | backend |
| anything else — the workflow, the scan's allowlist, scripts, Compose | all of them |

- **Backend** is Java 25, the Docker check and `mvn clean verify`. **Frontend**
  is Node and the portal's checks. **The guard self-test** proves the
  skipped-test guard ([ADR-006](ADR-006-testcontainers-for-integration-tests.md))
  still fails on a planted skip; the guard is the root POM's
  `fail-on-skipped-tests` and the self-test runs it in `core`.
- **The scheduled and manual runs run every check**, the journey suite
  ([ADR-014](ADR-014-real-service-browser-acceptance.md)) included. So does
  every failure of the changed-file lookup.
- **The checks are skipped step by step inside the one job**, never by
  `paths` filters on the trigger: the credential scan runs on every event, and
  the job's status check is always reported.
- **A file read across the boundary is registered in the classifier** in the
  same change that adds the read.

## Rationale

The classifier errs toward running. Only the explicit rows narrow anything, and
a path none of them names runs every check, so a forgotten case costs time and
never a check. The rows themselves are where a skip can be wrong, and they are
few, short and next to the comment that explains them.

The nightly is the backstop for the rule nothing enforces. A cross read that
nobody registered still skips its check on the pull request, but the next
scheduled run executes it against `main` within a day.

## Alternatives considered

### `paths` filters on the trigger, or one workflow per side — rejected

GitHub skips a workflow whose paths do not match, and with it the credential
scan, which must run on every change. A required status check on a skipped
workflow stays pending forever.

### One job per side, selected by a paths-filter action — rejected for now

Two jobs would also run in parallel and halve the wall-clock time. The workflow
keeps one job because GitHub bills each job by the started minute; reopen this
together with splitting the job.

### Build the affected Maven modules only (`-pl … -amd`) — rejected

The reactor is six modules and its coverage ratchet and skipped-test guard are
per module. A partial reactor would save seconds and make every floor depend on
which modules a change happened to touch.

## Consequences

### Positive

- A pull request that touches only `portal/web/` skips the Maven build; one that
  touches only Java skips the portal's checks and the Playwright install.
- A contract change runs both sides, so every contract test still sees it.
- The scope step's log names the checks a run selected and every path it could
  not classify.

### Negative

- Nothing checks the cross reads. A new one — a Java test reading a locale
  bundle, an npm script reading a POM — that is not added to the classifier
  lets a pull request that changes that file skip the test, and `main` can be
  red until the next nightly.
- The guard self-test no longer runs on most pull requests. A module POM other
  than `core`'s could still disable the guard for itself, which the self-test
  never covered.
- The classifier is shell in the workflow, so it is exercised only by the pull
  requests it classifies.
