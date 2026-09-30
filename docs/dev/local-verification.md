# Local verification

How to run this repository's test suites on a developer machine, and how to know
the run meant something. For running the whole stack by hand rather than testing
it, see [`infra/README.md`](../../infra/README.md).

## 1. Prerequisites

- **JDK 25.** The reactor targets `release 25` (ADR-001).
- **A container runtime.** Every integration suite uses Testcontainers against a
  real PostgreSQL (ADR-006). There is no mock substitute and no way to skip past
  this quietly; see section 3.
- **Node 20+** for `portal/web`.

If you manage the JDK with SDKMAN, asdf, or a similar tool, note that those are
usually initialised from an interactive shell profile. A script, an editor task,
or an agent running a non-interactive shell may not see them and will fall
through to whatever `java` is first on `PATH`. On macOS that is a stub that
reports "Unable to locate a Java Runtime", and Maven then fails with
`release version 25 not supported`. Export the toolchain explicitly in that
context rather than concluding the JDK is broken:

```bash
export JAVA_HOME="$HOME/.sdkman/candidates/java/current"
export PATH="$JAVA_HOME/bin:$PATH"
```

## 2. The commands

```bash
mvn clean verify
```

Runs unit tests, integration tests and the per-module coverage floors
(section 4). **Never pass `-T`**: the openapi-generator in `apps/api` races
under parallel builds and produces spurious "cannot find symbol" errors.

It does **not** run the portal's Vitest suite. The React SPA is a standalone
project with its own commands (ADR-017):

```bash
cd portal/web && npm ci && npm run test:coverage && npm run build
```

```bash
mvn clean verify -DskipITs
```

Unit tests only. This is the supported way to skip the integration suites; see
section 3 for why it has to be explicit.

```bash
mvn -pl adapters/persistence -am clean verify
```

One module and the modules it depends on: the loop you actually work in. `-am`
builds `core` first; omit it once `core` is installed and unchanged.

```bash
mvn -Parchitecture -pl core verify
```

The ArchUnit ring rules (ADR-015). Deliberately outside `mvn clean verify`; the
`Arch` workflow runs them nightly.

**Do not run a second Maven in this working tree while one is in progress.**
Concurrent runs in the same tree corrupt each other's `target/` and produce
failures that describe nothing real. Use a separate checkout if you need
parallelism.

### Browser and accessibility checks

Browser checks are part of the gate (ADR-014), and neither half runs in the
default build: the accessibility suite needs a Chromium binary Maven does not
download, and the journey suite needs the whole stack running. Both are
explicit commands rather than something `mvn verify` quietly skips.

```bash
cd portal/web && npx playwright install --with-deps chromium && npm run test:a11y
```

Serves the production SPA bundle with `vite preview` on `:4173` and runs the
axe/WCAG 2.2 AA suite against it. No backend, no containers. The `Build`
workflow runs these same steps on every pull request, on the nightly schedule
and on a manual dispatch.

```bash
infra/scripts/e2e.sh
```

Brings up PostgreSQL, the API and the BFF (through `infra/scripts/run-local.sh
--detach`), builds the SPA, runs the Playwright journey suite against it through
`vite preview` on `:4173` (which proxies the BFF routes to `:8081`), and stops
everything again. Pass `--no-build` to reuse the exec jars from a previous build,
or `--keep-up` to leave the stack running; the fastest loop when writing a
journey is one `--keep-up` run followed by
`E2E_BASE_URL=http://localhost:4173/app/ npx playwright test --project=journey`
in `portal/web`.

**When the journey suite runs:** on demand from a developer machine, and in the
`Build` workflow's nightly and manual runs, never on a pull request. Booting the
whole stack on every pull request costs more than the signal it adds, and the
nightly run catches the same regression within a day.

The journey project has **no** `baseURL` unless `E2E_BASE_URL` is set, so running
it without a stack fails rather than passing vacuously. That is deliberate: a
browser suite that quietly does not run is the same hole the skipped-test guard
closes for Maven.

An expected failure is marked with `test.fail()`, never skipped, so it keeps
executing and turns the suite red the moment the defect is fixed and the marker
is left behind.

## 3. When the container runtime is not found

The build fails, by design:

```
Required tests were skipped in <module> rather than executed:

    TEST-com.example.app....IT.xml
```

Without that guard, the Testcontainers suites would disable themselves and
`mvn clean verify` would exit `0` having executed no integration test at all:
the same exit code, and the same silence, as a run in which every one of them
passed (ADR-006).

If the runtime is running but not discovered, point Testcontainers at its
socket. For Rancher Desktop:

```bash
export DOCKER_HOST="unix://$HOME/.rd/docker.sock"
export TESTCONTAINERS_RYUK_DISABLED=true
```

Ryuk is the reaper container Testcontainers starts to clean up after itself; it
does not work on every rootless setup, and disabling it means stray containers
survive a hard kill. Run `docker ps` after an aborted run and remove what is
left.

If you genuinely want unit tests only, say so with `-DskipITs`. There is no
other opt-out: the repository contains no deliberately disabled test, so any
skip is a hole rather than a decision.

## 4. Coverage

Every `verify` writes a JaCoCo report per module:

```
<module>/target/site/jacoco/index.html   # to read
<module>/target/site/jacoco/jacoco.csv   # to compare
```

Unit and integration execution data are recorded separately and merged before
the report, so a line reached only by an integration test counts as covered.
`portal/web` is measured by Vitest (`npm run test:coverage`, HTML report in
`portal/web/coverage/`). The two instruments are read side by side and never
averaged.

**`mvn clean verify` fails when a module's merged instruction or branch coverage
falls below its recorded floor**, and `npm run test:coverage` fails below the
thresholds in `portal/web/vite.config.ts` (Vitest evaluates them only when
`--coverage` is passed, so `npm test` holds no floor). It is a **ratchet, not a
target** (ADR-019): each floor equals the last recorded measurement and no more.
The floors, the readings they came from and the procedure for moving one are in
[`docs/performance/coverage-ratchet.md`](../performance/coverage-ratchet.md).

Two things do not count as a way past a floor:

- **`mvn clean verify -DskipITs` does not fail the check.** That run still writes
  a report, and the report understates everything, so do not compare it against
  any reading.
- **`-Djacoco.skip`** would silence the check. Lowering a floor honestly is a
  reviewable change; a flag typed in a terminal is not.

## 5. Writing an integration test

Name it `*IT` so failsafe runs it in the integration phase; `*Test` belongs to
surefire and the unit phase. An abstract base class may be named either way;
surefire does not execute abstract classes.

**Declare the datasource the application needs.** The API fails closed on its
operational store, so an `apps/api` suite must register it or the Spring context
will not start. `ApiIntegrationTest` in `apps/api` does it once for every suite
that extends it:

```java
registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
registry.add("spring.datasource.username", POSTGRES::getUsername);
registry.add("spring.datasource.password", POSTGRES::getPassword);
```

**Mind the connection ceiling.** Suites that share one PostgreSQL container
across several Spring contexts each open a pool, and PostgreSQL's default limit
of 100 connections runs out quickly. If contexts start failing to connect, that
ceiling is the first thing to check.
