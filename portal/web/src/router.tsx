import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { APP_BASE_PATH } from "./api/auth";
import type { RouteHandle } from "./hooks/useDocumentTitle";
import { ShellLayout } from "./layout/ShellLayout";
import { Home } from "./pages/Home";
import { NotFound } from "./pages/NotFound";
import { RootError, RouteError } from "./pages/RouteError";

/** A route's `handle`: the i18n key the document title leads with. */
function titled(titleKey: string): RouteHandle {
  return { titleKey };
}

/**
 * The route inventory. Path segments are English identifiers and stable; what
 * a route is called on screen is the bundles' business (portal/CLAUDE.md).
 *
 * - **Everything renders inside the shell**, including the catch-all, so a
 *   mistyped URL still leaves the navigation in reach.
 * - **Every page declares an `errorElement`**, so a screen that throws while
 *   rendering — or whose lazily loaded code fails to arrive — is replaced by
 *   `RouteError` inside the shell rather than taking the document down. The
 *   root route's own `RootError` catches what the shell itself throws.
 * - **Every page declares `handle.titleKey`**, which `ShellLayout` turns into
 *   the document title.
 * - **Screens beyond the landing page are loaded on demand** (`lazy`), so the
 *   entry chunk carries the shell, Home and NotFound and nothing a user may
 *   never open.
 *
 * `/app/bff/**`, `/app/about` and `/app/health` belong to the BFF, which
 * answers them before its SPA fallback does — so no route may use `bff`,
 * `about` or `health` as its first segment. `apiContract.test.ts` walks this
 * tree to check it. That is why the page that shows build information lives
 * at `/build`.
 */
export const routes: RouteObject[] = [
  {
    element: <ShellLayout />,
    errorElement: <RootError />,
    children: [
      {
        index: true,
        element: <Home />,
        errorElement: <RouteError />,
        handle: titled("home.title"),
      },
      {
        path: "items",
        lazy: async () => ({ Component: (await import("./pages/items/ItemsPage")).ItemsPage }),
        errorElement: <RouteError />,
        handle: titled("items.title"),
      },
      {
        path: "build",
        lazy: async () => ({ Component: (await import("./pages/About")).About }),
        errorElement: <RouteError />,
        handle: titled("about.title"),
      },
      {
        path: "*",
        element: <NotFound />,
        errorElement: <RouteError />,
        handle: titled("notFound.title"),
      },
    ],
  },
];

export type AppRouter = ReturnType<typeof createBrowserRouter>;

let browserRouter: AppRouter | undefined;

/**
 * The application's router, mounted under the same `/app` base as Vite's
 * `base` and the BFF.
 *
 * Built on first use rather than at import — it reads the location when it is
 * created — and built once: a second instance would subscribe to the browser's
 * history as well, which StrictMode's double render would otherwise cause.
 */
export function appRouter(): AppRouter {
  browserRouter ??= createBrowserRouter(routes, { basename: APP_BASE_PATH });
  return browserRouter;
}
