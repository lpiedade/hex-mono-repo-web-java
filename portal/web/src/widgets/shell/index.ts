/**
 * Public API of the `shell` widget — the frame every page renders in: the
 * navigation rail, the top bar, the skip link and the landmarks (ADR-013).
 *
 * One widget rather than three (`nav`, `top-bar`, `shell`): the shell composes
 * the rail and the bar and owns the state both read (the rail's collapse and
 * width), so split into slices they would have to import one another, which a
 * layer forbids (ADR-027).
 */
export { ContentFallback } from "./ui/ContentFallback";
export { ShellLayout } from "./ui/ShellLayout";
export { NAV_ITEMS, type NavItemDef } from "./model/navItems";
