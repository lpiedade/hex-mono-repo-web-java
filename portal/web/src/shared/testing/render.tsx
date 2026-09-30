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
import "@/shared/i18n";
import { buildTheme, ColorModeContext, type ColorModeState } from "@/shared/theme";

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

/** The router `renderRoutes` builds, for a test that navigates or reads its state. */
export type TestRouter = ReturnType<typeof createMemoryRouter>;

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

/**
 * The light theme, and a color mode that does not change. The provider that
 * owns the real state is the app's (`app/providers`), which a suite below `app`
 * may not import; a suite about toggling provides its own context.
 */
const FIXED_COLOR_MODE: ColorModeState = { colorMode: "light", toggleColorMode: () => undefined };

function BaseProviders({ children, queryClient }: PropsWithChildren<{ queryClient: QueryClient }>) {
  return (
    <ThemeProvider theme={buildTheme("light")}>
      <CssBaseline />
      <ColorModeContext.Provider value={FIXED_COLOR_MODE}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ColorModeContext.Provider>
    </ThemeProvider>
  );
}

/** Renders a component with the providers every screen expects, inside a `MemoryRouter`. */
export function renderWithProviders(
  ui: ReactElement,
  options?: ExtendedRenderOptions,
): RenderResult {
  const { initialPath, queryClient, ...rest } = options ?? {};
  const qc = queryClient ?? createTestQueryClient();

  // The providers are a `wrapper` rather than inline JSX so that the returned
  // `rerender` re-applies them.
  function Providers({ children }: PropsWithChildren) {
    return (
      <BaseProviders queryClient={qc}>
        <MemoryRouter initialEntries={initialPath ? [initialPath] : undefined}>
          {children}
        </MemoryRouter>
      </BaseProviders>
    );
  }

  return render(ui, { wrapper: Providers, ...rest });
}

/**
 * Renders a route tree — the application's own `routes`, or a tree of the
 * test's — through a data router held in memory.
 *
 * `renderWithProviders` wraps its element in a `MemoryRouter`, which cannot
 * host route objects, `lazy`, `errorElement` or `handle`; this is the harness
 * for everything that depends on them. The router is returned, so a test can
 * navigate or read its state.
 */
export function renderRoutes(
  routes: RouteObject[],
  options: { initialPath?: string; queryClient?: QueryClient } = {},
): RenderResult & { router: TestRouter } {
  const router = createMemoryRouter(routes, { initialEntries: [options.initialPath ?? "/"] });
  const result = render(
    <BaseProviders queryClient={options.queryClient ?? createTestQueryClient()}>
      <RouterProvider router={router} />
    </BaseProviders>,
  );
  return { ...result, router };
}
