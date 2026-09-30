# ADR-027: The SPA is organized by Feature-Sliced Design, and its layering is linted

- Status: Accepted
- Date: Template baseline
- Related: [ADR-002](ADR-002-layered-core-and-apps-boundary.md), [ADR-009](ADR-009-react-typescript-and-spring-bff.md), [ADR-012](ADR-012-generated-contracts-and-remote-frontend-state.md), [ADR-013](ADR-013-mui-wcag-22-aa-design-system.md), [ADR-015](ADR-015-archunit-nightly-ring-report.md), [ADR-024](ADR-024-sorting-follows-the-collection.md)

## Context

`portal/web/src` was organized by kind of file: `api/`, `components/`, `hooks/`,
`layout/`, `pages/`, `theme/`, `locales/`, and one flat `__tests__/` folder for
every suite. With one example aggregate that reads well. With five it does not,
and the signs were already there with one:

- A feature's files were spread across the tree. The example resource `items`
  lived in `api/client.ts` (its calls), `pages/items/` (its screen, but also its
  dialog, its form model and its query key), `layout/navItems.ts` (its menu
  entry) and `__tests__/` (four suites). `pages/` had become a second place
  where features live, and nothing said which.
- Nothing stated a direction. A primitive in `components/` could import a
  screen, a screen could reach into another screen's internals, and the only
  defence was review.
- The test folder was flat and grouped by convenience: one suite covered four
  screens, another five primitives. Two guards that scan sources
  (`testsAssertKeys`, `errorReportingInventory`) globbed relative to that folder,
  so moving a suite would have taken it out of their reach without a failure.

Two properties of this repository make the question pressing rather than
cosmetic. It is a **template**: `items` is the example aggregate a project
replaces with its first real one, and that replacement should be one move — the
entity, the actions on it and its page — not an edit in six folders. And the
**backend already decided this for itself**: `core` is cut into rings that
subdivide by subdomain, with dependencies in one direction, checked by ArchUnit
against planted fixtures that prove each rule can fire
([ADR-002](ADR-002-layered-core-and-apps-boundary.md),
[ADR-015](ADR-015-archunit-nightly-ring-report.md)). The SPA had no equivalent:
its layering was prose.

Whatever the structure, the portal's rules had to stay true: every call goes
through one typed client ([ADR-012](ADR-012-generated-contracts-and-remote-frontend-state.md)),
tests assert i18n keys, screens compose the accessible primitives
([ADR-013](ADR-013-mui-wcag-22-aa-design-system.md)), and `DataTable`'s sort
hook lives beside it ([ADR-024](ADR-024-sorting-follows-the-collection.md)).

## Decision

`portal/web/src` follows **Feature-Sliced Design 2** — layers, slices, segments,
public APIs — and `npm run lint` enforces its import rules.

### Layers

Top to bottom; a layer imports only the layers below it.

| Layer | Holds | In the tree today |
| --- | --- | --- |
| `app` | The composition root: providers, the route tree, the route error pages, global styles | `App`, `providers/` (color mode, query client), `router/` (routes, `RouteError`), `styles/` (fonts) |
| `pages` | One slice per route: the screen, composing everything below | `home`, `items`, `build`, `not-found` |
| `widgets` | Large self-contained blocks shared by pages | `shell` (rail, top bar, identity card, skip link) |
| `features` | What a user *does*: an action, with its UI and its mutation | `edit-item`, `delete-item`, `change-language`, `toggle-color-mode`, `logout` |
| `entities` | What the product is *about*: a business object's types, queries and model | `item`, `user` |
| `shared` | What knows nothing of the product: the API client, the primitives, the theme, i18n | `api`, `ui`, `lib`, `theme`, `i18n`, `testing` |

FSD's `processes` layer is deprecated and not used.

### Slices, segments and public APIs

- `pages`, `widgets`, `features` and `entities` are cut into **slices** named
  by business meaning, in kebab-case. Inside a slice, code is grouped into
  **segments** by technical purpose: `ui`, `model`, `api`, `lib`, `config`.
- `shared` and `app` have **segments only**, no slices.
- Every slice and every `shared` segment has a **public API**, `index.ts`.
  Anything outside it imports only that file; anything inside it imports its
  neighbours relatively.

### Import rules

| From | May import |
| --- | --- |
| `app` | `pages`, `widgets`, `features`, `entities`, `shared` |
| `pages` | `widgets`, `features`, `entities`, `shared` |
| `widgets` | `features`, `entities`, `shared` |
| `features` | `entities`, `shared` |
| `entities` | `shared` |
| `shared` | other `shared` segments |

Two slices of one layer never import each other. Everything that crosses a
slice or a layer uses the `@/` alias (`@/entities/item`), declared once in
`tsconfig.json` and resolved identically by Vite, Vitest and ESLint.

```ts
import { itemQueries } from "@/entities/item";            // page → entity, public API: yes
import { ItemDialog } from "@/features/edit-item";        // page → feature: yes
import { ItemDialog } from "@/features/edit-item";        // in features/delete-item: no — sideways
import { itemQueries } from "@/entities/item/api/itemQueries"; // no — past the public API
import { ItemsPage } from "@/pages/items";                // in an entity: no — upwards
```

### Naming

- Folders — layers, slices, segments — are kebab-case, or `__tests__`.
- A component is `PascalCase.tsx` and exports the component it is named after;
  a hook is `useX.ts` and exports `useX`; any other module is `camelCase.ts`,
  named after its principal export or, failing one, the singular noun of its
  responsibility (`apiError.ts` exports `ApiError`; `geometry.ts` holds the
  shell's dimensions). A public API is `index.ts`.
- Generated code lives only under `generated/` (`shared/api/generated/`,
  git-ignored). Locale bundles are named by their locale tag.
- `main.tsx` (the Vite entry) and `vite-env.d.ts` are the only files outside the
  layers.

### Tests

- A suite is `<module>.test.ts(x)`, named after the module it tests, in the
  `__tests__/` folder of the slice or segment that holds that module.
- The **guards** — suites that hold an invariant of the whole tree rather than a
  module (the contract, the bundles, the key rule, the error inventory, the
  typecheck wiring, the layout, and the self-test below) — live together in
  `app/__tests__/guards/` and are named after the invariant. `app` is the one
  layer allowed to see every other, which is what a guard does.
- The harness is `shared/testing` (render helpers, key helpers, the console
  guard that Vitest loads as its setup file). Production code may not import it.

### Enforcement

- **`eslint-plugin-boundaries`**, in `npm run lint` (already a CI gate). The
  layers are its elements; `boundaries/dependencies` defaults to "disallow" and
  lists the downward directions, plus a last policy that refuses any target
  file other than a slice's or segment's `index.ts`. `eslint-import-resolver-typescript`
  resolves `@/` from `tsconfig.json`.
- **`no-restricted-imports`** refuses the test harness in production code and
  any import that climbs out of its folder twice (a cross-slice import written
  relatively).
- **A self-test**, `app/__tests__/guards/boundaries.test.ts`, lints planted
  violations through the project's own `eslint.config.js` — an upward import, a
  sideways one, deep imports past a slice's and a segment's `index.ts` — and
  fails if any stops being reported, as `ArchitectureTest` does for the backend.
  A clean import is linted too, so the rules cannot pass by reporting
  everything.
- **`app/__tests__/guards/structure.test.ts`** checks the layout itself: every
  module in a layer, kebab-case folders, the naming above, and every suite in
  the `__tests__/` of the slice that holds its module.
- The source-scanning guards glob from the project root, not from their own
  folder, and assert both a floor on what they see and that they reach every
  layer, so moving code cannot take it out of their reach.

### Placements worth stating

- **One `shell` widget, not three.** The shell composes the rail and the top
  bar and owns the state both read (the rail's collapse and width); as separate
  slices they would have to import one another.
- **i18n is initialized in `shared/i18n`, not `app`.** Every layer renders copy
  through react-i18next and every suite needs the instance; an `app`-owned init
  would make a `shared/ui` suite import `app`.
- **The color-mode context is `shared/theme`'s; its state is `app/providers`'**
  (`ColorModeProvider`); the toggle is a feature.
- **`useClientSort` stays in `shared/ui`, beside `DataTable`,** which types it
  (ADR-024).
- **The API client stays one file**, `shared/api/client.ts`: portal/CLAUDE.md
  names it as the place every call goes through, and `apiContract.test.ts`
  reads it. Entities build their query options on its functions.
- **Pages first.** Code one page needs stays in that page's slice — the build
  page's queries are `pages/build/api/`. It moves down a layer when a second
  consumer appears, not before.

## Rationale

The layer-by-type layout answers "what kind of file is this" and nothing else.
Feature-Sliced Design answers the questions that actually recur — where does a
new piece of code go, what may it import, what may import it — with a published
vocabulary and a fixed order, so the answer is the same for every contributor
and for an agent reading the rules. Slicing by business meaning is what makes
`items` replaceable as a unit: its entity, its features and its page are three
folders with public APIs, and nothing else in the tree reaches past them.

Enforcing it in lint rather than in review follows the backend's lesson — a rule
nothing checks is a rule that erodes — but at a different point: ESLint is fast
and per-file, so unlike the ArchUnit report
([ADR-015](ADR-015-archunit-nightly-ring-report.md)) it can gate every pull
request without slowing it, and it reports in the editor while the import is
being written. `eslint-plugin-boundaries` does this inside the lint job that
already runs, with its rules visible in `eslint.config.js` and an API the
self-test can drive.

## Alternatives considered

### Keep the layers by type — rejected

It costs nothing today and is familiar. It lost because it scales with the
number of features in the worst direction: every feature touches every folder,
the folders say nothing about what may import what, and replacing the template's
aggregate is a search across the tree.

### Feature folders without layers — rejected

`features/<name>/{api,components,hooks,pages}` groups a feature's files, which
is most of the benefit, and was the first proposal for this SPA. It lost because
it has no answer for the code two features share — it drifts into a new
`common/` folder that is the old layout again — and no direction between
features, so feature A importing feature B's internals is as legal as it was.

### Atomic Design — rejected

Atoms, molecules and organisms classify UI by granularity. MUI already supplies
the atoms, and the classification says nothing about data, state or business
actions, which is where the structure was needed.

### Route- or file-based colocation — rejected

Colocating code with its route (the Next.js or TanStack Router file-routing
style) couples the source tree to URLs, needs a router plugin this SPA does not
use, and has no place for code shared by routes. The route tree here is data in
`app/router/router.tsx`, which is also what lets a guard walk it.

### Monorepo packages per feature — rejected

Workspace packages give hard boundaries — a missing dependency is an install
error. They lost on cost: a `package.json`, build and version per feature for an
SPA of a few dozen modules, where a lint rule draws the same boundary for free.

### Steiger instead of eslint-plugin-boundaries — rejected for now

Steiger is FSD's own linter and checks structure as well as imports. It lost for
now because it is a second CLI and CI step beside ESLint, it is pre-1.0, and its
opinionated rules (a slice with one consumer is "insignificant") would flag the
template's deliberately small slices by design. Reopen it when it is stable and
structural checks beyond `structure.test.ts` are wanted.

## Consequences

### Positive

- The template's aggregate is replaced in one move: `entities/item`, the
  `edit-item` and `delete-item` features, `pages/items`, plus its route, its
  menu entry and its bundles.
- The direction of every import is checked on every pull request and shown in
  the editor; a layering violation is a lint error with a message naming this
  record.
- A slice's internals can change without touching its consumers, because only
  its `index.ts` is visible outside it.
- Suites live beside the code they test, and the guards that scan sources are
  immune to moves.

### Negative

- More folders and more files for a small app: seven slices, six `shared`
  segments and an `index.ts` for each, around a few dozen modules.
- "Feature or entity?" and "widget or page?" are judgment calls FSD does not
  settle mechanically. The line drawn here — an entity is what the product is
  about, a feature is what a user does to it — will need restating when a case
  is close; a feature as small as `logout` is the price of drawing it
  consistently.
- The rule that slices of one layer never import each other pushes shared code
  down a layer, sometimes before a second consumer exists. "Pages first" is the
  escape valve: code stays in the page that uses it until it is reused.
- Public APIs are barrels. A suite that imports `@/shared/ui` loads every
  primitive, and a barrel invites import cycles that per-file imports would not.
- The rules read `import` and `export` statements only. A test's `vi.mock` path
  or a `typeof import(...)` type may name a slice's internals, and does, to mock
  a module precisely; that is left to review.
- The self-test lints with type information and takes a few seconds of the
  suite.
- `eslint-plugin-boundaries` has changed its configuration model between major
  versions (v7 deprecated `entry-point` for policies on `dependencies`); an
  upgrade may need the rules rewritten, and the self-test is what shows it.
