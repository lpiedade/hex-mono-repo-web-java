// @ts-check
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import { defineConfig } from "eslint/config";
import boundaries from "eslint-plugin-boundaries";
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
 * (`tsconfig.json`) and the Node-side files (`tsconfig.node.json`) are each
 * linted against the types they are compiled with.
 */

/**
 * Feature-Sliced Design (ADR-027). Every layer, and what it may import — only
 * the layers below it. A slice never imports another slice of its own layer;
 * `shared` and `app` are cut into segments, not slices, and `shared`'s segments
 * may import one another.
 *
 * Imports inside one slice (or segment) are internal and not checked here.
 * `boundaries/dependencies` defaults to "disallow", so a direction that is not
 * listed — upwards, or sideways between two slices — is an error.
 */
const LAYERS = /** @type {const} */ (["app", "pages", "widgets", "features", "entities", "shared"]);

/** @param {readonly string[]} types */
const toLayers = (types) => ({ to: { element: { types: { anyOf: [...types] } } } });

const layerPolicies = LAYERS.map((layer, index) => ({
  from: { element: { type: layer } },
  allow: toLayers(layer === "shared" ? ["shared"] : LAYERS.slice(index + 1)),
}));

/**
 * A slice or segment is imported through its public API, `index.ts`, and
 * nothing else of it. Listed after the layer policies because the last policy
 * that matches decides: an import in an allowed direction is still refused when
 * it reaches past the target's `index.ts`.
 */
const publicApiPolicy = {
  disallow: { to: { element: { fileInternalPath: "!index.ts" } } },
  message: "Import a slice or segment through its public API, its index.ts (ADR-027).",
};

const fsd = {
  files: ["src/**/*.{ts,tsx}"],
  plugins: { boundaries },
  settings: {
    // Resolves the `@/` alias exactly as TypeScript does. An absolute path: a
    // relative one would be resolved against the process's working directory,
    // which is not this folder when ESLint runs from elsewhere (an editor, the
    // self-test).
    "import/resolver": {
      typescript: { project: `${import.meta.dirname}/tsconfig.json`, alwaysTryTypes: true },
    },
    "boundaries/root-path": import.meta.dirname,
    "boundaries/include": ["src/**/*"],
    "boundaries/elements": [
      { type: "app", pattern: "src/app" },
      { type: "pages", pattern: "src/pages/*", capture: ["slice"] },
      { type: "widgets", pattern: "src/widgets/*", capture: ["slice"] },
      { type: "features", pattern: "src/features/*", capture: ["slice"] },
      { type: "entities", pattern: "src/entities/*", capture: ["slice"] },
      { type: "shared", pattern: "src/shared/*", capture: ["segment"] },
    ],
  },
  rules: {
    "boundaries/dependencies": [
      "error",
      {
        default: "disallow",
        message:
          "A layer imports only the layers below it, and never another slice of its own " +
          "layer (ADR-027).",
        policies: [...layerPolicies, publicApiPolicy],
      },
    ],
  },
};

/** Imports that climb out of their folder twice cross a slice: they use the alias. */
const climbingImport = {
  group: ["../../*"],
  message: "An import that crosses a slice or a layer uses the @/ alias (ADR-027).",
};

export default defineConfig(
  {
    ignores: [
      "dist/",
      "coverage/",
      "playwright-report/",
      "test-results/",
      "blob-report/",
      // Generated from the contract by `npm run generate:api` (ADR-012).
      "src/shared/api/generated/",
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.node.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [jsxA11y.flatConfigs.recommended, reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
  },
  fsd,
  {
    // Production code: never the test harness, no climbing imports, and the
    // Fast Refresh rule — which suites and the harness, never hot-reloaded,
    // are outside of.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/__tests__/**", "src/shared/testing/**"],
    plugins: { "react-refresh": reactRefresh },
    rules: {
      // A module that exports a component exports only components, or Fast
      // Refresh reloads the whole module on every edit.
      "react-refresh/only-export-components": ["error", { allowConstantExport: true }],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/shared/testing", "@/shared/testing/*"],
              message: "The test harness (shared/testing) is for suites only.",
            },
            climbingImport,
          ],
        },
      ],
    },
  },
  {
    // Suites import their own slice relatively and the rest through the alias.
    // The guards read files outside src/ (the contract, package.json), which
    // only a relative path reaches.
    files: ["src/**/__tests__/**/*.{ts,tsx}", "src/shared/testing/**/*.{ts,tsx}"],
    ignores: ["src/app/__tests__/guards/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [climbingImport] }] },
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
