# ADR-014: Real-service browser acceptance

- Status: Accepted
- Date: Template baseline
- Related: [ADR-006](ADR-006-testcontainers-for-integration-tests.md), [ADR-009](ADR-009-react-typescript-and-spring-bff.md), [ADR-010](ADR-010-oidc-server-side-session-and-browser-security.md), [ADR-013](ADR-013-mui-wcag-22-aa-design-system.md), [ADR-017](ADR-017-static-spa-without-a-reverse-proxy.md), [ADR-019](ADR-019-coverage-ratchet-not-a-target.md)

## Context

The portal spans browser rendering, a cookie-session BFF, CSRF, the bearer API,
PostgreSQL, and generated contracts. Component tests with mocked HTTP cannot
prove cookies, CSRF, proxying, persistence, authorization, or cross-process
behaviour. Only a browser driving the real services can.

## Decision

Three layers, each with its own job:

- **Component tests** — Vitest and React Testing Library in `portal/web`, run
  as `npm run test:coverage` so the SPA's coverage floor in `vite.config.ts` is
  evaluated ([ADR-019](ADR-019-coverage-ratchet-not-a-target.md)). Fast
  feedback on behaviour and rendering.
- **Accessibility suite** (`npm run test:a11y`) — Playwright with axe against
  the production bundle served by `vite preview`. Contrast, focus order,
  semantics, and reflow are properties of the rendered document, so they need
  the real build and theme but not the API.
- **Journey suite** (`npm run test:journey`) — Playwright end to end against the
  real SPA, BFF, API, and PostgreSQL. A script under `infra/scripts` brings up
  PostgreSQL, the API and the BFF with `compose.yaml`, and the built SPA is
  served by `vite preview`, whose proxy forwards the BFF's paths to `:8081` —
  the same serving arrangement as local development
  ([ADR-017](ADR-017-static-spa-without-a-reverse-proxy.md)). Mocked HTTP, H2,
  or mocked JDBC do not satisfy it. It
  runs only when `E2E_BASE_URL` points at a running stack, and it *fails* when
  that variable is absent, for the same reason integration suites fail without
  Docker ([ADR-006](ADR-006-testcontainers-for-integration-tests.md)): a suite
  that quietly does not run reports success it did not earn.

Journeys cover the primary path through the product (for the template: list,
create, edit, and delete an item) and the security boundaries a mock cannot
reach — session, CSRF on mutations, direct navigation to a route, and failure
recovery when the API is down. A stack running the BFF in `dev` mode proves
everything but the login redirect itself; exercising `oidc` mode end to end
needs a deterministic test issuer in the stack
([ADR-010](ADR-010-oidc-server-side-session-and-browser-security.md)), and a
journey suite without one says so rather than implying it covers login.

Automated checks are supplemented by manual keyboard, contrast, reflow, and
screen-reader review ([ADR-013](ADR-013-mui-wcag-22-aa-design-system.md)).

Test data is synthetic throughout. Screenshots, traces, and reports are
retained only on failure, and the text of a report is scanned for credentials
before CI keeps it.

`mvn clean verify` remains the acceptance command for the Java modules; the
frontend suites are npm scripts that CI runs beside it
(`.github/workflows/build.yaml`). CI may split lanes — component and
accessibility suites on every pull request, the journey suite on a scheduled or
post-merge run where booting the whole stack per pull request costs more than
it adds — but no lane skips a required suite silently. Retries are
off: a flaky test is investigated, not re-run until green.

## Rationale

Only real browser and service integration proves the trust boundaries the BFF
introduces. Component tests remain the fast loop. Separating the accessibility
suite from the journey suite lets the cheap, API-free checks gate every change
while the expensive ones still run on a known schedule, instead of one suite
with half its assertions skipped.

## Alternatives considered

### Component tests with mocked HTTP only — rejected

They do not exercise cookies, sessions, CSRF, the proxy, the database, or
authorization.

### Cypress, run outside the Java build — rejected

Playwright meets the browser need, runs Chromium, Firefox, and WebKit from one
API, and ships an axe integration. A second browser tool with its own runner
and conventions would add a toolchain without adding coverage.

### Copies of production data as fixtures — rejected

They create privacy and artifact-retention risk that synthetic data avoids.

### Retries to absorb flakiness — rejected

A retried pass hides a real race in the product as often as one in the test.

## Consequences

### Positive

- End-to-end security and workflow behaviour is reproducible.
- Contract drift between browser, BFF, API, and database becomes visible.
- Accessibility failures can block a change.

### Negative

- The journey suite is slow and needs Docker and a browser.
- Journeys that run less often than every pull request catch a regression later
  than the change that introduced it.
- UI fixtures, and a test issuer if one is added, need maintenance.
- Browser artifacts need sanitising before they are retained.
