// @ts-check
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import { defineConfig } from "eslint/config";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * `npm run lint` — run with `--max-warnings 0`, so a warning fails CI as an
 * error does. Formatting is Prettier's (`npm run format:check`);
 * `eslint-config-prettier` comes last and turns off every rule that would
 * argue with it.
 *
 * Type-aware: both TypeScript projects are listed, so the browser code
 * (`tsconfig.json`) and the Playwright suites (`tsconfig.e2e.json`) are each
 * linted against the types they are compiled with.
 */
export default defineConfig(
  {
    ignores: [
      "dist/",
      "coverage/",
      "playwright-report/",
      "test-results/",
      "blob-report/",
      // Generated from the contract by `npm run generate:api` (ADR-012).
      "src/api/portal-api.d.ts",
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.e2e.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [jsxA11y.flatConfigs.recommended, reactHooks.configs.flat.recommended],
    plugins: { "react-refresh": reactRefresh },
    languageOptions: { globals: globals.browser },
    rules: {
      // A module that exports a component exports only components, or Fast
      // Refresh reloads the whole module on every edit.
      "react-refresh/only-export-components": ["error", { allowConstantExport: true }],
    },
  },
  {
    files: ["e2e/**/*.ts", "playwright.config.ts", "vite.config.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    // This file: plain JavaScript, in no TypeScript project.
    files: ["**/*.js"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
