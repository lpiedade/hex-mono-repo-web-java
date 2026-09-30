import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { ComponentProps, PropsWithChildren, ReactElement } from "react";
import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
  type RouteObject,
} from "react-router-dom";
import i18n from "../i18n";
import { ContentFallback } from "../layout/ContentFallback";
import type { AppRouter } from "../router";
import { buildTheme } from "../theme";
import { ColorModeProvider } from "../theme/ColorModeProvider";

/**
 * Resolves an i18n key the way the component under test will resolve it.
 *
 * **A test asserts the key, not the translation** (portal/CLAUDE.md). Writing
 * `getByRole("link", { name: "Itens" })` couples the suite to one locale's
 * copy: a reviewer who improves a label has to find and edit every test that
 * quoted the old wording. Going through this helper makes the assertion say
 * what it means — *this element is labelled by `nav.items`* — and copy edits
 * then touch the bundles alone.
 *
 * It resolves through the live {@link i18n} instance rather than a snapshot, so
 * a test that switches language sees the language it just switched to.
 * `options` reaches i18next untouched, which covers interpolation
 * (`t("items.edit", { name })`) and, through i18next's own `lng`, a locale
 * asserted explicitly (`t("nav.items", { lng: "pt-BR" })`).
 *
 * An unresolved key throws instead of returning the key itself. i18next renders
 * a missing key as its own name, which in an assertion would compare a key
 * against a key and pass.
 */
export function t(key: string, options?: Record<string, unknown>): string {
  const resolved = i18n.t(key, options ?? {});
  if (resolved === key) {
    throw new Error(
      `i18n key "${key}" resolves to nothing — the test would assert the key ` +
        "against itself and pass. Check the spelling, or add the key to every bundle.",
    );
  }
  return resolved;
}

/**
 * {@link t} as a case-insensitive `RegExp`, for the substring matches Testing
 * Library's `name` option takes. The resolved copy is escaped, so a label
 * carrying `(`, `.` or `?` matches literally rather than as a pattern.
 */
export function tRe(key: string, options?: Record<string, unknown>): RegExp {
  return new RegExp(tPattern(key, options), "i");
}

/** {@link tRe}, anchored — for a short label that is a prefix of a longer one. */
export function tReExact(key: string, options?: Record<string, unknown>): RegExp {
  return new RegExp(`^${tPattern(key, options)}$`, "i");
}

/**
 * The `RegExp`-safe form of a resolved key, for a name the component
 * *composes* rather than renders whole.
 */
export function tPattern(key: string, options?: Record<string, unknown>): string {
  return t(key, options).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * One entry of `MemoryRouter`'s history. Derived from the prop rather than
 * imported: react-router-dom re-exports the component but not this type.
 */
type InitialEntry = NonNullable<ComponentProps<typeof MemoryRouter>["initialEntries"]>[number];

interface ExtendedRenderOptions extends RenderOptions {
  /** The router's starting entry. */
  initialPath?: InitialEntry;
  /** A client of the test's own, when it needs to seed or inspect the cache. */
  queryClient?: QueryClient;
}

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

export function renderWithProviders(
  ui: ReactElement,
  options?: ExtendedRenderOptions,
): RenderResult {
  const { initialPath, queryClient, ...rest } = options ?? {};
  const qc = queryClient ?? createTestQueryClient();
  const theme = buildTheme("light");

  // The providers are a `wrapper` rather than inline JSX so that the returned
  // `rerender` re-applies them.
  function Providers({ children }: PropsWithChildren) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={initialPath ? [initialPath] : undefined}>
            {children}
          </MemoryRouter>
        </QueryClientProvider>
      </ThemeProvider>
    );
  }

  return render(ui, { wrapper: Providers, ...rest });
}

/**
 * Renders a route tree — normally the application's own `routes` — through a
 * data router held in memory, with the providers `App` supplies.
 *
 * `renderWithProviders` wraps its element in a `MemoryRouter`, which cannot
 * host route objects, `lazy`, `errorElement` or `handle`; this is the harness
 * for everything that depends on them. The router is returned, so a test can
 * navigate or read its state.
 */
export function renderRoutes(
  routes: RouteObject[],
  options: { initialPath?: string; queryClient?: QueryClient } = {},
): RenderResult & { router: AppRouter } {
  const router = createMemoryRouter(routes, { initialEntries: [options.initialPath ?? "/"] });
  const qc = options.queryClient ?? createTestQueryClient();
  const result = render(
    <ColorModeProvider>
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} fallbackElement={<ContentFallback />} />
      </QueryClientProvider>
    </ColorModeProvider>,
  );
  return { ...result, router };
}
