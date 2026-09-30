/**
 * Public API of `shared/testing` — the component suites' harness: key-asserting
 * helpers, providers, and the console guard (`setup.ts`, Vitest's setup file).
 * For suites only; ESLint refuses an import of it from production code.
 */
export {
  createTestQueryClient,
  renderRoutes,
  renderWithProviders,
  type TestRouter,
} from "./render";
export { expectConsole, setTestViewportWidth, TEST_VIEWPORT_WIDTH } from "./setup";
export { t, tPattern, tRe, tReExact } from "./translation";
