# Frontend standards (`portal/web`)

How the SPA in [`portal/web/`](../../portal/web/) is written: components,
hooks, remote state, forms, routing, errors, i18n, accessibility, styling,
TypeScript, tests and tooling — then where each kind of file lives, and a
walk-through for adding a feature.

The binding rules for the portal are in
[`portal/CLAUDE.md`](../../portal/CLAUDE.md): every call through the typed
client, remote state in React Query with invalidation, no silent failure,
WCAG 2.2 AA, localized copy, tests that assert keys, reserved route segments,
and who sorts a list. This guide does not restate them; it builds on them.
**Where the two disagree, `portal/CLAUDE.md` wins** and the disagreement is a
defect in this file. The reasons behind the rules are in the ADRs —
[ADR-009](../adr/ADR-009-react-typescript-and-spring-bff.md),
[ADR-010](../adr/ADR-010-oidc-server-side-session-and-browser-security.md),
[ADR-012](../adr/ADR-012-generated-contracts-and-remote-frontend-state.md),
[ADR-013](../adr/ADR-013-mui-wcag-22-aa-design-system.md),
[ADR-014](../adr/ADR-014-real-service-browser-acceptance.md),
[ADR-019](../adr/ADR-019-coverage-ratchet-not-a-target.md) and
[ADR-024](../adr/ADR-024-sorting-follows-the-collection.md).

**MUST**, **SHOULD** and **MAY** are used as in RFC 2119. A practice the tree
does not follow yet is marked **(adopt)** and listed under
[Adoption status](#adoption-status) at the end, so that a rule here is never
mistaken for a description of the code as it is.

## 1. Components

**MUST**

- One component per file, the file named after its export (`ItemsPage.tsx`).
  Named exports only. Props are an `interface <Name>Props`; no `React.FC`.
- A file that exports a component exports only components and types. Helpers,
  constants and factories go in a sibling `.ts` module — otherwise Fast Refresh
  reloads the whole module on every edit. `react-refresh/only-export-components`
  enforces it (`pageState.ts` beside `PageHeader`, `buildInfo.ts` beside
  `About`, `queryClient.ts` beside `App`).
- Screens compose the primitives in `src/components/` instead of rebuilding
  them from raw MUI: `PageHeader` (the page's one `h1` and its page state),
  `SectionCard` (a named region), `DataTable` with `useClientSort`, `Banner` and
  `ApiErrorBanner`, `ConfirmDialog`, `KeyValueList`, `FooterNote`.
- A primitive fetches nothing and localizes nothing it is handed: copy arrives
  as props. It may localize its own fixed chrome (a Cancel button, pager labels).
- **Derive, do not synchronize.** A value computable from props, state or query
  data is computed during render — memoized if expensive — and never copied
  into state by an effect. A form is seeded from its entity at mount and reset
  by remounting with a `key` (`ItemDialog`, keyed on the item id).
- Mutually exclusive UI states are one discriminated union, not several
  booleans — `ItemsPage`'s `{ kind: "none" | "create" | "edit" | "delete" }`.
- List keys are stable domain identifiers (`item.id`, a column `id`) — never an
  array index for a list that can reorder, never a localized label.
- Work caused by a user action runs in the event handler — persisting a
  preference, resetting a mutation, closing a drawer. `useEffect` is for
  synchronizing with something outside React (a subscription, a `window`
  listener, a `document` attribute) and always returns its cleanup.
- State updater functions are pure: no `setState` and no I/O inside
  `setX((prev) => …)`. StrictMode calls them twice in development. **(adopt)**
- A timer, listener or promise a component starts is cancelled or ignored once
  it unmounts. **(adopt)**

**SHOULD**

- Keep a screen under roughly 200 lines. When it grows, extract the column
  definitions, the row actions or a dialog into siblings in the feature.
- Use context only for app-wide values that change rarely (the color mode).
  Never as a store for server data — that is React Query's (ADR-012). Memoize a
  provider's value, and split contexts that change at different rates.
- Pass cross-cutting app state through a provider, not through more than two
  levels of props — the color mode comes from `ColorModeProvider` through
  `useColorMode()`, which the root route's `ShellLayout` reads.
- Reach for `useMemo` / `useCallback` / `React.memo` where identity or cost is
  real: a value a hook documents as needing to be stable (`useClientSort`'s
  accessors), a context value, an `Intl` formatter, a sort. A module-level
  constant beats a hook when nothing closes over props. Do not memoize by reflex.

## 2. Hooks

**MUST**

- The rules of hooks hold everywhere; `eslint-plugin-react-hooks` enforces them,
  with the React Compiler–derived rules of its v7 `recommended` set
  ([Tooling](#12-tooling)).
- A custom hook is named `use<Thing>`, lives in `use<Thing>.ts`, and returns a
  named object once it returns more than two values.
- A hook that is part of a primitive's contract lives beside the primitive
  (`useClientSort` beside `DataTable`, ADR-024). A hook shared across features
  goes in `src/hooks/`; a hook one feature uses stays in that feature.
- A callback a hook returns, and that callers may put in an effect's
  dependencies, is stable (`useCallback`).

**SHOULD**

- Extract a hook the second time the same stateful logic appears.
  `src/hooks/useDocumentTitle.ts` is the first shared one. Candidates in the
  tree today: `useCopyToClipboard` (duplicated in `ApiErrorBanner` and
  `GlobalErrorSnackbar`), `useDateTimeFormat` (a memoized `Intl.DateTimeFormat`
  for `i18n.language`).

## 3. Remote state

`portal/CLAUDE.md` fixes the frame: every call goes through
`src/api/client.ts`, remote state is React Query's, a write invalidates what it
affects, nothing is written into the cache by hand, and no failure is silent.
Within that frame:

**MUST**

- A typed call in `src/api/client.ts` destructures `{ data, error, response }`,
  throws `toApiError(response.status, error)` on failure, and returns the
  narrowed `data`. It re-exports the schema types a screen needs
  (`export type Item = components["schemas"]["Item"]`); nobody writes a wire
  type by hand.
- A call used as a query accepts the `AbortSignal` React Query passes and
  forwards it to `openapi-fetch`, so a superseded or unmounted query cancels its
  request (ADR-012 counts cancellation among the reasons for the library).
  **(adopt)**
- Query keys come from one factory per feature, paired with their `queryFn`
  through `queryOptions()`, so that a screen, a prefetch and an invalidation
  cannot name different keys. No inline key literals in components. **(adopt)**

  ```ts
  // features/items/api/queries.ts
  export const itemKeys = {
    all: ["items"] as const,
    list: () => [...itemKeys.all, "list"] as const,
    detail: (id: string) => [...itemKeys.all, "detail", id] as const,
  };

  export const itemQueries = {
    list: () =>
      queryOptions({ queryKey: itemKeys.list(), queryFn: ({ signal }) => listItems({ signal }) }),
  };
  ```

- A mutation whose failure the screen renders declares `meta: REPORTED_INLINE`
  as the **first property** of its `useMutation({` call —
  `errorReportingInventory.test.ts` recognizes exactly that shape. Every other
  mutation is listed in that suite's `CARRIED_BY_THE_NET`, with its reason.
- `onSuccess` awaits `invalidateQueries` on the feature's root key before it
  closes whatever started the mutation, so the dialog stays pending until the
  re-read lands.
- Every query's states are rendered: loading, failure (`pageStateOf` plus
  `ApiErrorBanner`), empty, ready. A component that uses a query only for
  decoration still renders a failure as a failure — never as a permanent
  "loading". **(adopt: `IdentityCard`)**
- A paused query — React Query's default `networkMode: "online"` pauses when
  the browser reports it is offline — is a state too. Either derive page state
  from `isPending` rather than `isLoading`, or run the client with
  `networkMode: "always"` (below), so a lost connection reaches the screen as
  the transport failure it already knows how to show. **(adopt)**

**SHOULD**

- Configure behaviour once, in `createQueryClient`:
  - `networkMode: "always"` for queries and mutations. The BFF is same-origin,
    so "offline" means "the BFF is unreachable", which has a message. Under
    `"online"`, a mutation started offline stays pending with its dialog's
    Cancel disabled until the network returns.
  - a `retry` predicate that does not retry a 4xx `ApiError` — a `403` or a
    `404` will not change a second later.
  - a global `staleTime`; a query overrides it only with a measured reason.
- Keep `useQuery` / `useMutation` in the component that renders the result, and
  take their options from the feature's factories:
  `useQuery(itemQueries.list())`,
  `useMutation({ meta: REPORTED_INLINE, ...itemMutations.save(queryClient, item) })`.
  Wrap the pair in a custom hook only when several components need it.
- Do not use `useSuspenseQuery`. Screens render loading and failure through the
  page-state model; a thrown promise would add a second loading UI and move
  errors to a boundary the screen does not control.
- Server data never goes into `useState` or a context.

**MAY**

- Load `@tanstack/react-query-devtools` lazily in development.

## 4. Forms

**MUST**

- Each form has a pure module, `<entity>Form.ts`, with no React in it:
  `valuesOf(entity)`, `validate(values)` returning an i18n key per invalid
  field, `toRequest(values)`, and `serverFieldErrors(fieldErrors)`. It is unit
  tested on its own. `pages/items/itemForm.ts` is the model.
- Inputs are controlled; the form is `<form noValidate onSubmit>` and submits
  through a `type="submit"` button.
- Validate on submit, then live. A failed submit moves focus to the first
  invalid field.
- A field's error and help reach assistive technology through MUI's `error` and
  `helperText`, which set `aria-invalid` and `aria-describedby`.
- The API stays the authority: its refusal is an `ApiErrorBanner` in the form,
  and each field error it names is also shown on that field.
- Client-side limits mirror the contract, and a test reads them from the YAML
  rather than restating the number. **(adopt: `itemForm.test.ts` asserts the
  literals 120 and 1000.)**
- ADR-013 requires an error summary. A form that can fail on more than one
  field at once shows one at its top — each error a link to its field — and
  focuses it on a failed submit. **(adopt — or amend ADR-013 to say which forms
  are exempt; today no form has one.)**
- A dialog form is mounted to open it and unmounted to close it, keyed on the
  entity it edits.

**SHOULD**

- Stay with hand-written controlled forms while they are small. Adopting
  `react-hook-form` — with the same pure `validate` as its resolver — is a
  decision to record when a form grows field arrays or beyond about six fields,
  not something to drift into.

## 5. Routing

**MUST**

- Routes are route objects in `src/router.tsx`, served by the data router
  (`createBrowserRouter` under the `/app` basename, `RouterProvider` in `App`).
  Route objects are data, which is what lets `apiContract.test.ts` walk every
  path and `router.test.tsx` check every page's declarations.
- Route segments are English identifiers, stable, and never start with `bff`,
  `about` or `health` (`portal/CLAUDE.md`). Every route, the catch-all included,
  renders inside the shell — the root route's element, `ShellLayout`.
- Every page declares `errorElement: <RouteError />`: a screen that throws, or
  whose lazily loaded code fails to arrive, is replaced inside the shell, never
  by a blank document. The root route's `RootError` covers the shell itself.
- Every page declares `handle: titled("<key>")`; the document title becomes
  `<page> · <app>` in the active locale (ADR-013 "a page title"; WCAG 2.4.2),
  on every navigation and every language change.
- A screen beyond the landing page is loaded on demand (`lazy`), so the entry
  chunk carries the shell, Home and NotFound and nothing a user may never
  open. While a navigation waits for a chunk the current page stays, with a
  progress bar and `aria-busy` on `main`; on a cold load `ContentFallback`
  stands in.
- After a client-side navigation, focus moves to the new page's `h1` (or
  `main`), so a screen-reader user learns that the page changed. **(adopt)**

**SHOULD**

- Keep URL state to opaque identifiers and safe filters (ADR-012). A
  server-paged list MAY keep its page, sort and filters in search params so a
  reload or a shared link reproduces it.
- Turn on React Router's `v7_*` future flags ahead of the upgrade.

## 6. Errors

`portal/CLAUDE.md`, *No failure is silent*, covers request failures. On top of
it:

**MUST**

- Two layers, never neither: route error elements for render errors, and the
  page state / `ApiErrorBanner` / global snackbar for request errors. A render
  error must not unmount the shell — without a boundary, React 18 unmounts the
  whole root. The snackbar sits beside the router, so it keeps reporting while
  an error page is on screen.
- An error page shows one generic, localized message, a reload and the way
  home — never the error's message or stack. React Router writes the error to
  the console for whoever debugs it.
- How a failure reads — a transport failure as `error.bffUnavailable`, the BFF's
  `503 UPSTREAM_UNAVAILABLE` as `error.upstreamUnavailable`, anything else as its
  `detail`, with the code and correlation id beneath — is one function that
  `ApiErrorBanner` and `GlobalErrorSnackbar` both call. **(adopt: the two
  components each carry a copy.)**
- A promise-returning handler is not handed to a DOM event directly: write
  `onClick={() => void copy()}` and handle the rejection inside —
  `navigator.clipboard` can be missing or refused. `no-misused-promises`
  enforces the first half.

**SHOULD**

- One assertive announcement per failure. When a screen shows both its page
  state and an `ApiErrorBanner` for the same query failure, only one of them is
  `role="alert"`. **(adopt: `ItemsPage` raises two.)**

## 7. Internationalization

`portal/CLAUDE.md` fixes keys, bundles, parity and how tests assert copy. On
top of it:

**MUST**

- Sentences are interpolated (`t("items.edit", { name })`), never assembled
  from translated fragments. Counts use i18next plural suffixes, one for every
  category the locale's `Intl.PluralRules` produces. **(adopt: pt-BR has a
  `many` category; with no `items.count_many`, a count of 1,000,000 renders the
  English `items.count_other`. `locales.test.ts` demands identical key sets,
  so it has to learn per-locale plural suffixes first.)**
- Dates and numbers go through `Intl` with `i18n.language` — one shared,
  memoized formatter — and never `toLocaleString()` without a locale. A count
  interpolated into copy is number-formatted.
- A key built at run time (`nav.${key}`, `pageState.${state}`) comes from a
  closed union in code. A value that arrives from the wire (a role, a status)
  maps to its key with an explicit *unsupported* fallback (ADR-012), never to
  a raw key path.
- The document title, `aria-label`s, tooltips and placeholders are copy.

**SHOULD**

- Type the keys: declare i18next's `CustomTypeOptions` with
  `resources: { translation: typeof enUS }`, so a misspelled key fails `tsc`
  rather than rendering its own name. **(adopt)**
- Render an absent value through one component (an `EmptyValue` with an
  accessible name) rather than a bare "—" glyph in each screen.
- Once there are more than two locales, load bundles lazily.

**MAY**

- Match `navigator.languages` against `SUPPORTED_LOCALES` on a first visit,
  before falling back to `DEFAULT_LOCALE`.

## 8. Accessibility

WCAG 2.2 AA (ADR-013). `portal/CLAUDE.md` lists what the primitives carry and
how the axe sweep is extended. On top of it:

**MUST**

- Semantic HTML first; ARIA only to fill a gap. An icon-only button has an
  `aria-label` equal to its tooltip.
- A live region is in the DOM before its content changes, is empty at mount,
  and receives text only after a user action — the rail announcement in `Shell`
  is the model. **(adopt: `DataTable`'s sort region is populated at mount.)**
- A status is announced once: no visible text plus a visually hidden copy of
  the same words. **(adopt: `PageStateNotice` reads "Loading…" twice.)**
- A menu button carries `aria-haspopup`, `aria-expanded` and `aria-controls`,
  and the chosen option is exposed (`menuitemradio` + `aria-checked`).
  **(adopt: `LanguageSelector`.)**
- A dialog is labelled by its title, described by its message, puts initial
  focus on the least destructive action, and returns focus on close.
- Page titles and focus on navigation — see [Routing](#5-routing).

**SHOULD**

- Give each new journey a manual screen-reader pass. ADR-013 counts the tools
  as evidence, not certification.

## 9. Styling

MUI 5 under the application theme in `src/theme/` (ADR-013).

**MUST**

- Colors, radii, elevation and fonts come from the theme — palette paths in
  `sx` (`"text.secondary"`, `"divider"`, `"background.paper"`) and
  `theme.app.*` for the raw tokens — so one line serves both modes. No hex
  literal outside `tokens.ts`.
- `sx` for one-off styles; a module-level `SxProps<Theme>` constant when a file
  reuses one (Nav's `itemSx`); `theme.components` for app-wide defaults;
  `styled()` only for a reusable styled primitive with no logic. No `style`
  attribute and no imperative style mutation. **(adopt: the skip link in
  `Shell` rewrites `style.cssText` on focus and blur.)**
- Spacing on the theme scale (`p: 2`, `gap: 1`), not pixel strings.
- Type sizes through typography variants. A size the theme lacks becomes a new
  variant (module augmentation), not a `fontSize` in a component. **(adopt:
  `IdentityCard`, `Nav`.)**
- Styling goes in `sx`, not in system props on `Box` or `Stack` (`mt`,
  `display`, `gap`, `justifyContent`) — MUI 6 deprecates those.
- Icons are imported by path (`@mui/icons-material/Add`).
- A new token pair is asserted in `src/__tests__/theme.test.ts`.

**SHOULD**

- The color mode lives in one provider, `ColorModeProvider`, exposed through
  `useColorMode()`. It SHOULD also persist the choice, as the locale and the
  rail width already are. **(adopt: it does not persist yet.)** On MUI 6 it
  becomes `colorSchemes` with CSS variables.

## 10. TypeScript

**MUST**

- `strict` stays on, in both projects: `tsconfig.json` for the browser code and
  `tsconfig.e2e.json` (with `@types/node`) for `e2e/` and
  `playwright.config.ts`. `npm run typecheck` compiles both.
- No `any`: `unknown` plus narrowing at a trust boundary (`toApiError`). A cast
  only at a boundary, with a comment saying why.
- Wire types come from `portal-api.d.ts` through the aliases `api/client.ts`
  re-exports. The generated file is never edited.
- Variants are discriminated unions, checked exhaustively (`never` in the
  default branch). Constant maps use `satisfies`; literal tuples `as const`.

**SHOULD**

- Add `noUncheckedIndexedAccess` (two errors in `src/`, eleven in the suites,
  at the review), `verbatimModuleSyntax` and `noImplicitOverride` (none). Leave
  `exactOptionalPropertyTypes` off: MUI's prop types reject it.
- Import across top-level folders through an `@/` alias (tsconfig `paths` plus
  Vite `resolve.alias`); relative imports within a feature.

## 11. Testing

`portal/CLAUDE.md` fixes the gate (`npm run test:coverage`), the browser
suites, and the rule that a test asserts the key. On top of it:

**MUST**

- Query by role and accessible name first (`getByRole("button", { name:
  t("items.create") })`), then by label, then by text.
  `container.querySelector` only for structure the accessibility tree does not
  expose (`<time datetime>`, `<dl>`).
- `const user = userEvent.setup()` per test, every interaction awaited — a key
  chord too (`user.keyboard("{Control>}/{/Control}")`), not a hand-dispatched
  event. `fireEvent` only when no user-event equivalent exists. A change caused
  from outside React (a report from the error net, a language switch) is
  flushed with `act` — awaited when it is asynchronous — before anything is
  asserted; global state is reset only after `cleanup()` has unmounted the tree.
- Render through `renderWithProviders` from `test-utils`, or through
  `renderRoutes` when the test needs the data router (`lazy`, `errorElement`,
  `handle`). A test about both themes builds its own `ThemeProvider`.
- Screen suites mock `api/client` at the module boundary with typed
  `vi.mocked`, and state each function's answer in the `beforeEach` or the test
  that relies on it — mocks are restored before every test (`clearMocks`,
  `restoreMocks`, `unstubGlobals` in the Vitest config), so an answer set once
  at module level does not survive the first test.
- The run is clean. `test-setup.ts` fails a test on any `console.error` or
  `console.warn` it did not declare; a test about such output calls
  `expectConsole("error" | "warn")` and asserts on the spy it returns. React's
  "not wrapped in act(...)" warning fails a test even when it declared errors.
- Assert behaviour, not implementation — no inline styles, class names or hook
  internals.
- A feature ships with: a screen suite (list, empty, loading, failure, each
  write, an inline refusal, a field error), its form module's unit test,
  `client.test.ts` cases for new calls, and an `apiContract.test.ts`
  response-shape assertion for every shape the screen relies on.

**SHOULD**

- Prefer jest-dom matchers (`toBeInTheDocument`, `toHaveAttribute`) to
  `toBeTruthy` and `getAttribute`.

**MAY**

- Use MSW for a screen suite that should exercise the real client and its
  middleware. `client.test.ts` covers that path against a stubbed `fetch` today.

Where suites live is part of the folder structure below.

## 12. Tooling

- **ESLint** (`eslint.config.js`, `npm run lint` with `--max-warnings 0`, in
  the CI gate): `@eslint/js`, `typescript-eslint` `recommendedTypeChecked` over
  both TypeScript projects, `eslint-plugin-react-hooks` `recommended` (v7: the
  rules of hooks plus the compiler-derived purity, set-state-in-effect, refs,
  …), `eslint-plugin-react-refresh` and `eslint-plugin-jsx-a11y` `recommended`
  for `src/`, and `eslint-config-prettier` last. ESLint stays on 9 because
  `eslint-plugin-jsx-a11y` 6.10 declares no support for 10. A rule is disabled
  only inline, for one line, with the reason after `--` — the dialogs'
  deliberate `autoFocus` is the example.
- The suites SHOULD also get `eslint-plugin-testing-library`,
  `eslint-plugin-jest-dom` and `@vitest/eslint-plugin`. **(adopt)**
- **Prettier** (`.prettierrc.json`): `printWidth: 100` — the width that changed
  the fewest lines of the existing tree — and otherwise Prettier's defaults.
  `npm run format:check` is in CI; `npm run format` writes. Markdown is left to
  the repository's documentation conventions (`.prettierignore`).
- **Import order**: external packages, then `@/`, then relative; type-only
  imports inline (`import { type Item }`). SHOULD be enforced by
  `eslint-plugin-simple-import-sort`. **(adopt)**
- **Bundle**: `chunkSizeWarningLimit` stays at Vite's default 500 kB so growth
  shows up in the build output. Third-party code is split by `manualChunks`
  (`vite.config.ts`) into `react`, `mui` and `vendor`, which import only
  downwards and change only when a dependency does; each screen beyond the
  landing page is a chunk of its own. At the change that introduced them:
  entry 32.6 kB (12.3 kB gzipped), `react` 142.7 kB (45.7), `vendor` 171.3 kB
  (54.3), `mui` 278.1 kB (86.2), `ItemsPage` 9.4 kB, `About` 2.3 kB — against
  one 584 kB chunk (184 kB gzipped) before. Measure with
  `rollup-plugin-visualizer` when a dependency is added.
- **Upgrades** — what stands in the way today:

  | Upgrade | Blocker or work |
  | --- | --- |
  | React 19 | `@mui/material` 5.16.7 and `@testing-library/react` 16.0.1 declare `react ^17 \|\| ^18` / `^18`; both need a newer release. The tree uses none of the removed APIs (`forwardRef`, function `defaultProps`, string refs, `ReactDOM.render`). |
  | MUI 6 | System props on `Box`/`Stack`, `TablePagination`'s `SelectProps` (→ `slotProps.select`), `Drawer`'s `ModalProps`; the `@mui/codemod` v6 recipes cover them. Color mode moves to `colorSchemes`. |
  | React Router 7 | `v7_*` future flags. The data router (`createBrowserRouter`, route objects, `lazy`) is already the v7 shape. |

## 13. Folder structure

### Today

```
portal/web/
  e2e/                  Playwright: *.a11y.spec.ts, *.journey.spec.ts, i18n.ts (key resolver)
  eslint.config.js      ESLint (type-aware, both projects)
  tsconfig.e2e.json     the Playwright suites' TypeScript project (@types/node)
  src/
    main.tsx            entry: fonts, createRoot, StrictMode
    App.tsx             providers, RouterProvider, GlobalErrorSnackbar
    queryClient.ts      createQueryClient: the caches wired to the error net
    router.tsx          route objects (data router): shell, pages (lazy beyond Home), error elements
    i18n.ts             i18next init, SUPPORTED_LOCALES, missing-key report
    test-setup.ts       jest-dom, the console guard (expectConsole), the matchMedia stub
    api/                client.ts, auth.ts, errors.ts, errorReporting.ts, portal-api.d.ts (generated)
    components/         primitives, pageState.ts, useClientSort.ts, a11y.ts
    hooks/              useDocumentTitle.ts (useDocumentTitle, useRouteTitle)
    layout/             ShellLayout (root route), Shell, ContentFallback, Nav, TopBar,
                        IdentityCard, navItems, navPreferences, dimensions
    pages/              Home, About (/build) + buildInfo.ts, NotFound, RouteError,
                        items/ (page, dialog, form, query key)
    theme/              tokens, MUI theme, contrast, fonts, ColorModeProvider, colorMode.ts
    locales/            en-US.json, pt-BR.json
    __tests__/          every Vitest suite, plus test-utils.tsx (renderWithProviders, renderRoutes)
```

Layers are folders, and the one example resource is split between `pages/`
(its screens) and `api/client.ts` (its calls). That reads well at one resource
and stops reading well at five: a feature's files are spread across the tree,
and `pages/` becomes a second place where features live.

### Target

```
portal/web/
  e2e/                          unchanged
  src/
    main.tsx                    entry
    app/                        composition root — the only place that wires providers
      App.tsx                   providers, RouterProvider, GlobalErrorSnackbar
      queryClient.ts            createQueryClient (caches → api/errorReporting)
      router.tsx                route tree: shell, feature routes (lazy), NotFound, errorElement
      RouteError.tsx            the route error page
      ColorModeProvider.tsx     color mode: state, persistence, useColorMode
    api/                        transport, no React — paths portal/CLAUDE.md names stay
      client.ts                 bffClient and every typed call
      auth.ts                   CSRF + login-redirect middleware, APP_BASE_PATH
      errors.ts                 ApiError, Problem Details
      errorReporting.ts         the global net
      errorPresentation.ts      how a failure reads (shared by banner and snackbar)
      portal-api.d.ts           generated, git-ignored
    components/                 generic primitives (DataTable + useClientSort, PageHeader, …)
    hooks/                      cross-feature hooks (useDocumentTitle, useCopyToClipboard, …)
    lib/                        pure helpers (formatting, display) — no React, no I/O
    layout/                     the shell: Shell, Nav, TopBar, IdentityCard, navItems.ts
    features/
      items/
        api/
          queries.ts            itemKeys, itemQueries (queryOptions)
          mutations.ts          itemMutations (mutationFn + invalidation)
        components/             ItemDialog.tsx, DeleteItemDialog.tsx
        model/
          itemForm.ts           pure form logic
        pages/
          ItemsPage.tsx
        routes.tsx              the feature's route objects (lazy page, title key)
        __tests__/              ItemsPage.test.tsx, itemForm.test.ts
      system/                   build information (/build) and the user-context queries
    pages/                      app-level pages that belong to no feature: Home, NotFound
    theme/                      unchanged
    locales/                    unchanged
    i18n.ts                     unchanged
    test-setup.ts               unchanged
    __tests__/                  test-utils.tsx and the suites that guard the whole tree:
                                apiContract, locales, missingKeys, testsAssertKeys,
                                errorReportingInventory, typecheck, theme, primitives
```

### What goes where

| Folder | Holds | Never holds |
| --- | --- | --- |
| `app/` | Providers, the query client, the route tree, the route error page | Screens, feature logic |
| `api/` | The `openapi-fetch` client, its middleware, typed calls, error types, the global net | React, query keys, copy |
| `components/` | Primitives any screen may use, and hooks that are part of a primitive's contract | `useQuery`, imports from `api/client.ts`, `features/` or `layout/`; copy other than their own chrome |
| `hooks/`, `lib/` | Reusable hooks; pure functions | Feature knowledge |
| `layout/` | The shell and its parts. May query what the shell shows (the identity) | Screen content |
| `features/<name>/api/` | Query keys, `queryOptions`, mutation options — built on functions from `api/client.ts` | `fetch`, `bffClient`, a request of its own |
| `features/<name>/model/` | Pure form and view logic | React |
| `features/<name>/pages/` | One component per route | Primitives others would reuse |
| `features/<name>/components/` | Parts only this feature uses | Anything a second feature needs — that moves to `components/` |
| `pages/` | Home, NotFound | A page that belongs to a feature |

Dependencies point one way: `app` → `layout`, `features`, `pages` →
`components`, `hooks`, `lib` → `api`, `theme`, `i18n`. A feature does not
import another feature's files; what two features share moves down a level.

### Migration

Move in this order — each step leaves the gate green.

1. **Teach the source-scanning guards the new layout first.**
   `testsAssertKeys.test.ts` globs `./**/*.{test,spec}.{ts,tsx}` from
   `src/__tests__/`, so a suite moved into a feature would silently escape the
   key rule; make it glob `/src/**/*.{test,spec}.{ts,tsx}`.
   `errorReportingInventory.test.ts` treats every path outside `src/__tests__/`
   as production code; make it skip `*.test.*` files instead, and update the
   mutation ids it expects. Change the coverage exclude in `vite.config.ts` to
   `src/**/__tests__/**`.
2. Move `pages/items/` into `features/items/`, splitting `queryKeys.ts` into
   `api/queries.ts` and `api/mutations.ts`. Move `About` and the user-context
   key into `features/system/`.
3. Move `App.tsx`, `queryClient.ts`, `router.tsx`, `pages/RouteError.tsx` and
   `theme/ColorModeProvider.tsx` into `app/`, and add the `@/` alias. Each
   feature then contributes its route objects from its own `routes.tsx`.
4. Update the layout and *Adding a resource* sections of
   [`portal/web/README.md`](../../portal/web/README.md).

Two things stay where they are. The files `portal/CLAUDE.md` links to by path —
`api/client.ts`, `api/auth.ts`, `api/errorReporting.ts`,
`components/useClientSort.ts`, `locales/`, `__tests__/test-utils.tsx`,
`__tests__/theme.test.ts` — keep their paths. And `api/client.ts` stays one
file: `portal/CLAUDE.md` names it as the place every call goes through, and
`apiContract.test.ts` reads it as text. Splitting it per resource means
changing that rule and that suite together, deliberately.

## 14. Adding a feature

For a resource `<name>` (plural, English), in this order:

1. **Contract.** Add the operations to `docs/arch/api-layer/openapi-v1.yaml`
   and their proxied twins, with `x-proxies-to`, to `portal-api-v1.yaml`. The
   path shape follows
   [ADR-020](../adr/ADR-020-resource-shape-and-url-nesting.md); the BFF gains
   nothing to reshape (`portal/CLAUDE.md`, *The BFF stays thin*).
2. **Generate.** `npm run generate:api`, then `npm run typecheck`, and follow
   the compiler.
3. **Calls.** Add typed functions to `src/api/client.ts`: unwrap, throw
   `ApiError`, forward `signal`. Re-export the schema types the screens use.
   Add `client.test.ts` cases for the path, the method and the body.
4. **Queries and mutations.** `features/<name>/api/queries.ts` (a key factory
   and `queryOptions`) and `mutations.ts` (a `mutationFn` plus invalidation of
   the feature's root key).
5. **Model.** `features/<name>/model/<entity>Form.ts` if there is a form, with
   limits mirrored from the contract and a unit test that reads them from the
   YAML.
6. **Page.** `features/<name>/pages/<Name>Page.tsx`: `PageHeader` with
   `pageStateOf`, `ApiErrorBanner` for the query's failure, `DataTable` with
   `useClientSort` for a collection fetched whole or server-side sort for a paged
   one (ADR-024). Each mutation the page renders inline carries
   `meta: REPORTED_INLINE`; any other is listed in `CARRIED_BY_THE_NET`.
7. **Route.** Add the feature's route object to the route tree in
   `router.tsx`: an English segment that is not `bff`, `about` or `health`,
   `lazy` for the page, `errorElement: <RouteError />` and
   `handle: titled("<name>.title")`. `router.test.tsx` fails on a page without
   the last two.
8. **Navigation.** An entry in `layout/navItems.ts` under a `nav.<key>` label.
9. **Copy.** Every new key — title, labels, tooltips, empty state, errors,
   plural forms — in **both** bundles, in the same change.
10. **Tests.** The screen suite through `t()` (list, empty, loading, failure,
    each write, inline refusal, field error); an `apiContract.test.ts`
    response-shape assertion for each shape the screen relies on; the route in
    `e2e/portal.a11y.spec.ts`'s `ROUTES`, and an a11y test for each dialog or
    inline error the sweep cannot reach; a journey step in
    `e2e/*.journey.spec.ts` when the feature is a shipped journey (ADR-014).
11. **Verify.** From `portal/web/`:
    `npm ci && npm run lint && npm run format:check && npm run test:coverage && npm run build`,
    then `npm run test:a11y`. If coverage rose, the ratchet moves as
    [`coverage-ratchet.md`](../performance/coverage-ratchet.md) describes.

## Adoption status

What the tree does not yet follow. Each item is marked **(adopt)** where it is
stated above; remove it from both places when it lands.

Landed since the review of 2026-09-30: the data router with an error element
per page and a root one for the shell; a localized document title per route;
lazily loaded screens and split vendor chunks under Vite's default size
warning; the route-tree guard in `apiContract.test.ts`; ESLint and Prettier in
the CI gate; type-checking of `e2e/` and `playwright.config.ts`; the console
guard in `test-setup.ts`, restored mocks, and no `act` warnings; the color mode
in a provider instead of props; handled clipboard rejections.

- **Routing:** no focus move on navigation.
- **Remote state:** inline query keys (`About.tsx`, `IdentityCard.tsx`) and no
  `queryOptions`; no `signal` forwarded (`api/client.ts`); a paused query
  renders nothing (`pageStateOf` reads `isLoading`); `IdentityCard` renders a
  failure as "loading".
- **Components and hooks:** a side effect inside a state updater
  (`navPreferences.ts`, `toggleCollapsed`); uncleared timers in
  `ApiErrorBanner.tsx` and `GlobalErrorSnackbar.tsx`, with the
  failure-rendering logic duplicated between them; the color mode is not
  persisted.
- **Accessibility:** `DataTable`'s live region populated at mount;
  `PageStateNotice` announces loading twice; two alerts for one failure in
  `ItemsPage`; `LanguageSelector` lacks `aria-expanded`/`aria-controls`; no
  error summary on forms.
- **i18n:** untyped keys; pt-BR `many` plural missing.
- **Styling:** the skip link's imperative styles (`Shell.tsx`); pixel font
  sizes in `IdentityCard.tsx` and `Nav.tsx`.
- **Tooling:** no Testing Library, jest-dom or Vitest lint plugins for the
  suites; no enforced import order.
- **Tests:** `itemForm.test.ts` restates the contract's limits as literals.
