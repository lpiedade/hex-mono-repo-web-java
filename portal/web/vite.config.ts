import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/** Where the BFF runs during development; `vite preview` reuses the same proxy. */
const BFF = "http://localhost:8081";

/**
 * Third-party code in chunks of its own, so an application change does not
 * invalidate the browser's cached copy of React or MUI, and no chunk crosses
 * Vite's default 500 kB warning. `chunkSizeWarningLimit` is deliberately left
 * at that default: a warning is how the bundle's growth becomes visible.
 *
 * The groups only ever import downwards — `mui` and `vendor` import `react`,
 * nothing imports `mui` but the application — so no two chunks import each
 * other. Stylesheets (the self-hosted fonts) stay with the entry chunk.
 */
function vendorChunk(id: string): string | undefined {
  if (!id.includes("/node_modules/") || id.endsWith(".css")) return undefined;
  if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react";
  if (/\/node_modules\/(@mui|@emotion|@popperjs|react-transition-group)\//.test(id)) return "mui";
  return "vendor";
}

/**
 * A lazily loaded page is named after its slice (`page-items-<hash>.js`), not
 * after the file Rollup would take its name from: every slice's public API is
 * an `index.ts` (ADR-027), so every page chunk — and the entry — would otherwise
 * be `index-<hash>.js`, unreadable in the build output and impossible to tell
 * apart from outside (the a11y suite aborts one page's chunk by name).
 */
function chunkFileName(chunk: { facadeModuleId: string | null }): string {
  const page = chunk.facadeModuleId?.match(/\/src\/pages\/([^/]+)\/index\.tsx?$/);
  return page ? `assets/page-${page[1]}-[hash].js` : "assets/[name]-[hash].js";
}

export default defineConfig({
  base: "/app/",
  plugins: [react()],
  resolve: {
    // `@/<layer>/<slice>` — the same alias `tsconfig.json` declares (ADR-027).
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsDir: "assets",
    rollupOptions: {
      output: { manualChunks: vendorChunk, chunkFileNames: chunkFileName },
    },
  },
  server: {
    proxy: {
      "/app/bff": BFF,
      "/app/health": BFF,
      "/app/about": BFF,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/shared/testing/setup.ts"],
    globals: true,
    // Vitest's default glob would also collect e2e/*.spec.ts, which are
    // Playwright suites: they call `test()` from @playwright/test, which throws
    // outside a Playwright runner. Component suites belong in the `__tests__/`
    // folder of the slice or segment they test — but the glob runs a suite
    // wherever it is, and `guards/structure.test.ts` is what fails a misplaced one,
    // so a wrong folder is a red test rather than a suite that silently never
    // runs.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Every test starts from pristine doubles: call history cleared, spies and
    // `vi.fn()` implementations restored, stubbed globals put back. A mock's
    // answer is therefore stated in the `beforeEach` or the test that relies on
    // it, never once at module level for the whole file.
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        // Generated contract types (ADR-012) — instrumenting them would shift
        // the denominator whenever the contract grows.
        "src/shared/api/generated/**",
        // The bootstrap — the Vite entry and the app layer's public API, which
        // registers the fonts and re-exports App. No testable behavior; the
        // suites import App itself.
        "src/main.tsx",
        "src/app/index.ts",
        // Type-only declarations.
        "src/vite-env.d.ts",
        // Font-face side effects only, imported by the app's public API and
        // deliberately kept out of the test graph so jsdom never parses font CSS.
        "src/app/styles/fonts.ts",
        // The test harness and the suites describe the tests, not the product.
        "src/shared/testing/**",
        "src/**/__tests__/**",
      ],
      // The ratchet (ADR-019): a floor equal to the last recorded measurement,
      // and no higher. It answers one question — did this change reduce what
      // the tests reach? The procedure for moving it, and the table of past
      // readings, is docs/performance/coverage-ratchet.md. Raising a floor
      // after coverage improves is an edit to these four numbers and to that
      // file's table; lowering one requires the same edit plus the reason.
      //
      // Not rounded up. Each value is the measured ratio truncated to two
      // decimals, so the floor is at or below what was observed and never
      // above it.
      //
      // Thresholds are only evaluated when --coverage is passed, which is why
      // CI runs `npm run test:coverage` and not `npm test`.
      thresholds: {
        statements: 99.09,
        branches: 96.05,
        functions: 95.12,
        lines: 99.09,
      },
    },
  },
});
