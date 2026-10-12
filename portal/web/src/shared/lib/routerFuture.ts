import type { createBrowserRouter, FutureConfig } from "react-router-dom";

type DataRouterFuture = NonNullable<
  NonNullable<Parameters<typeof createBrowserRouter>[1]>["future"]
>;

/**
 * React Router's v7 behaviors, adopted ahead of the v7 upgrade. Since 6.28 a
 * router that leaves one of them undecided warns when it mounts, and a suite
 * fails on a warning it did not declare (`shared/testing/setup.ts`). So every
 * router the portal builds — the application's and the suites' — takes the
 * same decision from here, and the suites exercise the behavior that ships.
 *
 * `Required`, so a flag a later 6.x adds is a type error here rather than a
 * warning in every suite. The fetcher, form-method and action flags change
 * nothing yet: no route has a loader or an action, and nothing uses a fetcher.
 *
 * `v7_partialHydration` is decided against. With it, a route whose `lazy`
 * import failed keeps rendering the hydration fallback instead of its
 * `errorElement`, so a chunk that did not arrive would leave a spinner on
 * screen for good rather than `RouteError` ("a screen whose code fails to
 * load" in `RouteError.test.tsx`). Revisit it with the v7 upgrade.
 */
export const ROUTER_FUTURE = {
  v7_fetcherPersist: true,
  v7_normalizeFormMethod: true,
  v7_partialHydration: false,
  v7_relativeSplatPath: true,
  v7_skipActionErrorRevalidation: true,
} satisfies Required<DataRouterFuture>;

/**
 * The `future` of a rendering router — `RouterProvider`, `MemoryRouter`. It
 * decides whether state updates are wrapped in `React.startTransition`; a
 * `MemoryRouter`, which has no data router behind it, also takes the splat-path
 * decision from here.
 */
export const RENDER_FUTURE = {
  v7_startTransition: true,
  v7_relativeSplatPath: ROUTER_FUTURE.v7_relativeSplatPath,
} satisfies Required<FutureConfig>;
