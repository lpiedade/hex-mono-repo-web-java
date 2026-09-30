import { describe, expect, it } from "vitest";

/**
 * Where a file lives and what it is called (ADR-027), checked rather than
 * reviewed:
 *
 * - **Folders** are kebab-case — layers, slices, segments — or `__tests__`.
 * - **A component** is `PascalCase.tsx` and exports the component it is named
 *   after; **a hook** is `useX.ts(x)` and exports `useX`; **any other module** is
 *   `camelCase.ts(x)`; a slice's or segment's public API is `index.ts`.
 * - **A suite** is `<module>.test.ts(x)`, in the `__tests__/` folder of the
 *   slice or segment that holds `<module>` — so it is found where the code is,
 *   and a misplaced one is a red test here rather than one that is hard to
 *   find. The cross-cutting guards in this folder are named after the invariant
 *   they hold instead.
 *
 * Outside the layers: `main.tsx` (the Vite entry), `vite-env.d.ts`, the
 * generated contract types and the locale bundles (named by locale tag).
 */

const MODULES = import.meta.glob<string>(["/src/**/*.{ts,tsx}", "!/src/**/*.d.ts"], {
  query: "?raw",
  eager: true,
  import: "default",
});

/**
 * The count when last checked — a floor, so a glob that stopped matching fails.
 * (A glob never returns the file that runs it, so this suite is not counted.)
 */
const MINIMUM_MODULES = 119;

const OUTSIDE_THE_LAYERS = new Set(["/src/main.tsx"]);
const GUARDS = "/src/app/__tests__/guards/";

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PASCAL = /^[A-Z][A-Za-z0-9]*$/;
const CAMEL = /^[a-z][A-Za-z0-9]*$/;

const paths = Object.keys(MODULES).filter((path) => !OUTSIDE_THE_LAYERS.has(path));
const suites = paths.filter((path) => /\.test\.tsx?$/.test(path));
const production = paths.filter((path) => !path.includes("/__tests__/"));

/** `pages/items` for `/src/pages/items/ui/ItemsPage.tsx`; `app` and `shared/<segment>` likewise. */
function unitOf(path: string): string | undefined {
  return /^\/src\/(app|(?:pages|widgets|features|entities|shared)\/[^/]+)\//.exec(path)?.[1];
}

function stemOf(path: string): string {
  return (path.split("/").pop() ?? path).replace(/(\.test)?\.tsx?$/, "");
}

describe("the source layout", () => {
  it("sees every module", () => {
    expect(paths.length).toBeGreaterThanOrEqual(MINIMUM_MODULES);
  });

  it.each(paths)("%s sits in a layer, under kebab-case folders", (path) => {
    expect(unitOf(path), "every module belongs to app, a slice, or a shared segment").toBeDefined();
    const folders = path.split("/").slice(2, -1);
    for (const folder of folders) {
      expect(folder === "__tests__" || KEBAB.test(folder), `folder "${folder}"`).toBe(true);
    }
  });

  it.each(production)("%s is named after what it exports", (path) => {
    const stem = stemOf(path);
    const source = MODULES[path];
    if (stem === "index") return;
    if (PASCAL.test(stem)) {
      expect(path.endsWith(".tsx"), "a component is a .tsx file").toBe(true);
      expect(source).toMatch(new RegExp(`export (function|const) ${stem}\\b`));
    } else if (/^use[A-Z]/.test(stem)) {
      expect(source).toMatch(new RegExp(`export function ${stem}\\b`));
    } else {
      expect(stem, "a module that is not a component is camelCase").toMatch(CAMEL);
    }
  });

  it.each(suites)("%s sits in the __tests__ folder of the slice it tests", (path) => {
    expect(path).toMatch(/\/__tests__\/(guards\/)?[^/]+\.test\.tsx?$/);
    if (path.startsWith(GUARDS)) return;

    const unit = unitOf(path);
    const stem = stemOf(path);
    const tested = production.filter(
      (module) => unitOf(module) === unit && stemOf(module) === stem,
    );
    expect(tested, `a module named ${stem} in ${unit}`).not.toEqual([]);
  });
});
