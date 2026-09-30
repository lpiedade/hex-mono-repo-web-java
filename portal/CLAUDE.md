# Portal (BFF + SPA) development guidance

Scope: the `portal` module — the Spring Boot BFF under `portal/bff/` and the
React/TypeScript SPA under `portal/web/`. These rules are in addition to the
repository root `CLAUDE.md`. What the portal is and how a request travels is in
[`README.md`](README.md).

## The BFF stays thin

The BFF (packages `com.example.app.portal`) authenticates and proxies. It does
not serve the SPA — that is static assets behind CloudFront or the Vite proxy
(ADR-017) — and it does not aggregate, reshape or validate — the API is the authority
for every rule (ADR-009). A proxied body is the API's body, which is why
`portal-api-v1.yaml` references `openapi-v1.yaml`'s schemas instead of copying
them; an endpoint the browser needs that the API does not have belongs in the
API first.

Authentication is chosen by `app.bff.auth.mode` — `oidc` (server-side session,
the browser holds only a cookie) or `dev` (a pre-shared token, local only) —
and the SPA must work unchanged under both (ADR-010). It does so by reacting to
what the BFF answers, never by asking which mode it runs in: a `401` with the
BFF's code `SESSION_REQUIRED` navigates to `/app/bff/oauth2/authorization/oidc`
(the API's own `UNAUTHENTICATED` does not — logging in again would not fix a
refused relayed token, and redirecting on it would loop), and every
mutating request carries `X-XSRF-TOKEN` from the `XSRF-TOKEN` cookie when one
exists. Both live in `web/src/shared/api/auth.ts`; a new call made outside
`shared/api/client.ts` would bypass them, so do not make one.

The BFF owns `bff`, `about` and `health` under `/app`. No SPA route may start
with one of those segments — a reload would get the BFF's JSON instead of the
page. `apiContract.test.ts` walks the whole route tree in `web/src/app/router/router.tsx`,
and the navigation, and checks every first segment against the contract.

## The SPA is Feature-Sliced (ADR-027)

`web/src` has six layers, top to bottom: `app`, `pages`, `widgets`,
`features`, `entities`, `shared`. A layer imports only the layers below it; two
slices of one layer never import each other; a slice or a `shared` segment is
imported only through its `index.ts`, with the `@/` alias. `npm run lint`
enforces it (`eslint-plugin-boundaries`), and
`web/src/app/__tests__/guards/boundaries.test.ts` fails if the rules stop
firing against planted violations. Where a new piece of code goes, the naming,
and where its suite lives are in [`web/README.md`](web/README.md); the
template's aggregate `items` is `entities/item`, the `edit-item` and
`delete-item` features, and `pages/items` — replace it in that one move.

## Contracts and remote state

The SPA's types are generated from
[`portal-api-v1.yaml`](../docs/arch/api-layer/portal-api-v1.yaml) by
`npm run generate:api`, and every call goes through the typed client in
`web/src/shared/api/client.ts` (ADR-012). `apiContract.test.ts` fails when the client
calls a route the contract does not declare; `tsc` fails when a screen reads a
field the contract no longer has. Change the contract first, regenerate, then
follow the compiler.

Remote state is React Query's. A write invalidates the queries it affects and
lets them re-read; nothing is written into the cache by hand unless a screen
has a measured reason to.

### No failure is silent

A request failure is either rendered by the screen or reported by the global
net in `web/src/shared/api/errorReporting.ts` — never neither.

- A **query** failure is the screen's to render, as its page state
  (`pageStateOf`) and usually an `ApiErrorBanner`. The net only logs it.
- A **mutation** failure is shown by the global snackbar unless the screen
  renders it itself, in which case the mutation declares
  `meta: REPORTED_INLINE`. `errorReportingInventory.test.ts` pins the
  mutations left to the net, so adding one is a decision, not a default.
- An error on screen carries the stable `code` and the `correlationId`, never a
  stack or an internal URL. A transport failure shows the generic
  "portal unreachable" message; the BFF's `503 UPSTREAM_UNAVAILABLE` shows
  "service unavailable, try again".

A **render** failure — a screen that throws, or whose lazily loaded code does
not arrive — is caught by its route's `errorElement` and replaced, inside the
shell, by `RouteError`: one localized message, a reload and the way home, never
the error itself. What the shell itself throws is caught by the root route's
`RootError`. So every route in `router.tsx` declares an `errorElement`;
`router.test.tsx` fails on one that does not. The global snackbar sits beside
the router and keeps reporting while an error page is on screen.

## Accessibility is WCAG 2.2 AA (ADR-013)

The theme's color pairs are asserted in both modes by
`web/src/shared/theme/__tests__/buildTheme.test.ts`, and the `a11y` Playwright project runs axe
over every route in both themes, at 320px, and under reduced motion. A new
route goes into `e2e/portal.a11y.spec.ts`'s `ROUTES`; a state the sweep cannot
reach without data (an open dialog, an inline error) gets a test of its own.

Every route declares `handle: { titleKey }`, and the document title becomes
`<page> · <app>` in the active locale (`app.documentTitle`), following each
navigation and each language change (WCAG 2.4.2). `index.html`'s `<title>` is
only the pre-boot default, kept equal to the `en-US` `app.name`.

Composed primitives carry the semantics so screens do not have to: one `h1`
per page through `PageHeader`, named regions through `SectionCard`, captioned
tables with `aria-sort` through `DataTable`, live regions through `Banner`.
Never convey state by color alone, and never render API content as markup.

## Code is in English (en-US)

All source code is written in English: component, function, variable, type and
constant names; file and folder names; **URL route path segments** (`/items`,
not `/itens`); **i18n keys** and their namespaces (`nav.items`, not
`nav.itens`); comments and commit messages.

Only user-facing strings are exempt — and those are never hardcoded.

## User-facing text is localized, never hardcoded

Any text a user can read goes through i18n (`react-i18next`); it never appears
as a string literal in a component. Bundles live in
`web/src/shared/i18n/locales/<locale>.json`, and every key must exist in each:

- `en-US` — English (the default)
- `pt-BR` — Portuguese (Brazil)

Add a key to every bundle in the same change; `locales.test.ts` fails
otherwise. Keys and route segments are identifiers, not copy: keep them stable
and never translate them per locale. A missing key is logged in development
(`reportMissingKey` in `shared/i18n/i18n.ts`) and renders as its own name.

To add a locale: a new bundle, an entry in `SUPPORTED_LOCALES` and in
`BUNDLES` (`shared/i18n/i18n.ts`), its autonym in `LanguageSelector`, and the
locale in `e2e/i18n.ts`. The bundle-scanning guards read `BUNDLES`, and
`locales.test.ts` fails on a bundle file nobody registered.

### The `en-US` bundle is American English

`en-US` copy uses American spelling — **catalog**, **center**, **canceled**,
**analyze**, **behavior**, **color**, **artifact**. This governs rendered
values only: an existing key keeps its spelling, and a contract enum key is the
wire's (`identity.role.ADMIN`), with only its label translated.

### A test asserts the key, not the translation

A test may not quote product copy. It names the key and lets i18next resolve
it — `t` / `tRe` / `tReExact` / `tPattern` from
[`web/src/shared/testing`](web/src/shared/testing/translation.ts) in the
component suite, `t` / `tAny` / `tAnyExact` from [`web/e2e/i18n.ts`](web/e2e/i18n.ts)
in the Playwright suites.

```tsx
// no
expect(screen.getByRole("link", { name: "Itens" })).toBeInTheDocument();
// yes
expect(screen.getByRole("link", { name: t("nav.items") })).toBeInTheDocument();
```

Otherwise a bundle edit becomes a source edit: rewording a label turns into a
red suite in files the change never touched, and the whole suite is pinned to
`DEFAULT_LOCALE`. It is enforced by
[`testsAssertKeys.test.ts`](web/src/app/__tests__/guards/testsAssertKeys.test.ts), which
scans both suites and names the key to use in its failure. Its blind spots are
written down in that file; a **fragment** (`/iten/i`) is the same coupling with
a smaller quote and is the reviewer's to refuse.

- Interpolation and locale stay in the test: `t("items.edit", { name })`,
  `t("nav.items", { lng: "pt-BR" })`.
- Copy a test supplies itself is not copy: a presentational primitive
  localizes nothing, so its test passes a literal and asserts it back. Pick a
  literal no bundle holds.
- A key the bundles do not resolve **throws** in `t()`, rather than letting an
  assertion compare a key against itself and pass.

## Who sorts a list is decided by who holds it

A screen that fetched its collection **whole** — no `limit`, no cursor, no
`page`/`rowCount`/`onPageChange` on `DataTable` — sorts it in memory through
[`useClientSort`](web/src/shared/ui/useClientSort.ts) and issues no request.
A screen that **pages through the backend** sends the sort with its next
request and never reorders the rows it holds. `ItemsPage` is the worked example
of the first kind.

"Few rows" is not the criterion: sorting one page of a paged list reorders a
window while looking exactly as if it reordered the list. `DataTable` itself
never sorts; it renders the order it is given and reports the clicked column.

## Validation

- BFF: `mvn clean verify` at the repository root.
- SPA: the frontend is a standalone npm project, not driven by Maven. From
  `portal/web/`, run
  `npm ci && npm run lint && npm run format:check && npm run test:coverage && npm run build`
  before committing, and `npm run test:a11y` when a screen changes.

**Lint and format are gates.** `npm run lint` is ESLint with type information
(typescript-eslint, react-hooks, react-refresh, jsx-a11y, and the layering
rules of eslint-plugin-boundaries) and fails on a warning as on an error; `npm run format:check` is Prettier. `npm run format`
writes the formatting. A rule is disabled only inline, for one line, with the
reason after `--` — never file-wide to make a finding go away.

**`test:coverage`, not `test`.** Both run the same suite, but Vitest evaluates
the coverage floor in `vite.config.ts` only when `--coverage` is passed, and
`pretest:coverage` is what runs the typechecker — both projects,
`tsconfig.json` for the browser code and `tsconfig.node.json` for the Node side
(the Playwright suites, their config, the Vite config). The floor is a ratchet — the last recorded measurement, truncated, and
no higher (ADR-019) —
and [`docs/performance/coverage-ratchet.md`](../docs/performance/coverage-ratchet.md)
is how to move it.

**A clean run.** A component test fails on any `console.error` or
`console.warn` it did not declare (`web/src/shared/testing/setup.ts`), because that is
where React, MUI and the portal report defects. A test that is about such
output calls `expectConsole("error" | "warn")` and asserts on the spy it
returns; React's "not wrapped in act(...)" warning fails a test regardless.
Mocks are restored before every test, so a mock's answer is set in the
`beforeEach` or the test that relies on it.

**Browser suites.** `a11y` needs only the production build (`vite preview`).
`journey` drives a real stack and **fails** when `E2E_BASE_URL` is unset
rather than skipping, because a check that silently did not run is reported as
one that passed (ADR-014).
