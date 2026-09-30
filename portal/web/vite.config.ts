import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Where the BFF runs during development; `vite preview` reuses the same proxy. */
const BFF = "http://localhost:8081";

export default defineConfig({
  base: "/app/",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsDir: "assets",
    chunkSizeWarningLimit: 1024,
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
    setupFiles: ["./src/test-setup.ts"],
    globals: true,
    // Vitest's default glob would also collect e2e/*.spec.ts, which are
    // Playwright suites: they call `test()` from @playwright/test, which throws
    // outside a Playwright runner. Component tests live under src/; the browser
    // suites belong to playwright.config.ts and run in a real browser.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        // Generated contract types (ADR-012) — instrumenting them would shift
        // the denominator whenever the contract grows.
        "src/api/portal-api.d.ts",
        // Application entry point — bootstrap only, no testable behavior.
        "src/main.tsx",
        // Type-only declarations.
        "src/vite-env.d.ts",
        // Font-face side effects only, imported by main.tsx and deliberately
        // kept out of the test graph so jsdom never parses font CSS.
        "src/theme/fonts.ts",
        // The test harness describes the suite, not the production surface.
        "src/test-setup.ts",
        "src/__tests__/**",
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
        statements: 98.53,
        branches: 95.17,
        functions: 93.47,
        lines: 98.53,
      },
    },
  },
});
