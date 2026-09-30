import { Route, Routes } from "react-router-dom";
import { Shell } from "./layout/Shell";
import { About } from "./pages/About";
import { Home } from "./pages/Home";
import { ItemsPage } from "./pages/items/ItemsPage";
import { NotFound } from "./pages/NotFound";

interface RouterProps {
  colorMode: "light" | "dark";
  onToggleColorMode: () => void;
}

/**
 * The route inventory. Path segments are English identifiers and stable; what
 * a route is called on screen is the bundles' business (portal/CLAUDE.md).
 * Every route renders inside the shell, including the catch-all, so a mistyped
 * URL still leaves the navigation in reach.
 *
 * `/app/bff/**`, `/app/about` and `/app/health` belong to the BFF, which
 * answers them before its SPA fallback does — so no client route may use
 * `bff`, `about` or `health` as its first segment. That is why the page that
 * shows build information lives at `/build`.
 */
export function AppRouter({ colorMode, onToggleColorMode }: RouterProps) {
  return (
    <Routes>
      <Route
        element={<Shell colorMode={colorMode} onToggleColorMode={onToggleColorMode} />}
      >
        <Route index element={<Home />} />
        <Route path="items" element={<ItemsPage />} />
        <Route path="build" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
