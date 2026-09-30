import { defineConfig, devices } from "@playwright/test";

/**
 * Browser acceptance and accessibility evidence for the portal (ADR-013,
 * ADR-014).
 *
 * Two suites with different needs, so they are separate projects rather than one
 * run with half the assertions skipped:
 *
 * - **`a11y`** exercises the production SPA bundle in a real browser. Contrast,
 *   focus order, semantics and reflow are properties of the rendered document, so
 *   they need the real build and the real theme but not the API. `vite preview`
 *   serves exactly the bytes the deployed image would.
 * - **`journey`** is end-to-end against the real portal, BFF, API and database,
 *   which ADR-014 requires and which mocked HTTP explicitly does not satisfy. It
 *   runs only when `E2E_BASE_URL` points at a running stack, and it *fails*
 *   rather than skipping when that variable is absent: a browser suite that
 *   quietly does not run reports a check that never happened.
 */

const JOURNEY_BASE_URL = process.env.E2E_BASE_URL;
const PREVIEW_PORT = 4173;

export default defineConfig({
  testDir: "./e2e",
  // No test may depend on another's leftovers or on wall-clock timing.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    trace: "retain-on-failure",
    // Traces and screenshots may reach CI artifacts, so the fixtures the suites
    // use are synthetic throughout.
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "a11y",
      testMatch: /.*\.a11y\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://localhost:${PREVIEW_PORT}/app/`,
      },
    },
    {
      name: "journey",
      testMatch: /.*\.journey\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: JOURNEY_BASE_URL,
      },
    },
  ],

  // Serves the same production bundle the image ships, so the a11y suite reads
  // minified, themed, real markup rather than a dev-server approximation.
  webServer: {
    command: `npx vite preview --port ${PREVIEW_PORT} --strictPort`,
    port: PREVIEW_PORT,
    // infra/scripts/e2e.sh starts `vite preview` itself for the journey run and
    // sets E2E_BASE_URL; reuse that server rather than failing on the busy port.
    reuseExistingServer: !process.env.CI || !!process.env.E2E_BASE_URL,
    timeout: 120_000,
  },
});
