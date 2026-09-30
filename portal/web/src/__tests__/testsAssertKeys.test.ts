import { describe, expect, it } from "vitest";
import enUS from "../locales/en-US.json";
import ptBR from "../locales/pt-BR.json";

/**
 * Enforces the portal/CLAUDE.md rule **a test asserts the key, not the
 * translation**: no test may quote a string that is a translation value in any
 * bundle. It goes through `t("some.key")` from `test-utils` instead.
 *
 * The cost of the other way: renaming one label, which is a bundle edit and
 * nothing else, reddens tests in files the change never touched, and the
 * failure message names the old copy rather than the decision that was made.
 * Quoted literals also pin the suite to `DEFAULT_LOCALE`.
 *
 * It is a source scan, so it sees a literal and not a use. That cuts both ways
 * and is stated rather than implied:
 *
 * - **It cannot tell an assertion from a fixture.** A value that must be a
 *   literal — a wire enum, a fixture whose text happens to match some label —
 *   is listed in {@link NOT_COPY} with the reason it is not copy.
 * - **It cannot catch a literal that is not currently *in* a bundle.** A test
 *   asserting text a component hardcodes is invisible here; that is the
 *   "never hardcoded" half of the rule, which review owns.
 * - **It cannot catch a partial quote.** A fragment of a label matches no
 *   bundle value, so it passes. Writing one is deliberate evasion, not an
 *   accident this test should be sized to catch.
 */
type Json = { [key: string]: string | Json };

function values(obj: Json, acc = new Map<string, string[]>(), prefix = "") {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null) {
      values(value, acc, path);
    } else {
      const text = String(value).trim();
      if (!text) continue;
      acc.set(text, [...new Set([...(acc.get(text) ?? []), path])]);
    }
  }
  return acc;
}

const KEYS_BY_VALUE = [enUS as Json, ptBR as Json].reduce(
  (acc, bundle) => values(bundle, acc),
  new Map<string, string[]>(),
);

/**
 * Literals that match a bundle value and are not copy. Each entry is
 * `<file>:<literal>`, and each needs a reason: this list is the seam through
 * which the rule can be evaded, so it stays short and stays argued.
 */
const NOT_COPY = new Set<string>([
  // The `aria-sort` attribute's token, which the ARIA spec spells. That the
  // en-US value of `table.sortedAscending` is the same word is a collision.
  "DataTable.test.tsx:ascending",
]);

/**
 * String and template literals, plus the bodies of regular-expression
 * literals — `getByText(/Itens/i)` is the same coupling as the quoted form.
 */
function literalsIn(source: string): { line: number; text: string }[] {
  const found: { line: number; text: string }[] = [];
  source.split("\n").forEach((line, index) => {
    // Comment blocks discuss copy by quoting it, which is documentation.
    if (/^\s*(\*|\/\/)/.test(line)) return;
    // A suite's own name is blanked rather than read: `describe("Items")`
    // names the screen, and that a bundle also says "Items" is a collision.
    const scanned = line.replace(
      /(^\s*(?:describe|it|test)(?:\.\w+)?(?:\([\s\S]*?\))?\()\s*(["'`])(?:\\.|(?!\2)[^\\])*\2/,
      "$1$2$2",
    );
    const patterns = [/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g, /\/((?:\\.|[^/\\\n])+)\/[dgimsuy]*/g];
    for (const pattern of patterns) {
      for (const match of scanned.matchAll(pattern)) {
        found.push({ line: index + 1, text: match[2] ?? match[1] });
      }
    }
  });
  return found;
}

/**
 * Both suites, because the rule is about the bundles and not about a runner.
 * The Playwright specs cannot import `test-utils` — they run outside Vitest and
 * outside Vite — so they resolve keys through `e2e/i18n.ts` instead.
 */
const sources = {
  ...import.meta.glob<string>("./**/*.{test,spec}.{ts,tsx}", {
    query: "?raw",
    eager: true,
    import: "default",
  }),
  ...import.meta.glob<string>("../../e2e/*.spec.ts", {
    query: "?raw",
    eager: true,
    import: "default",
  }),
};

describe("a test asserts the key, not the translation", () => {
  // This suite quotes the bundles by construction.
  const files = Object.entries(sources).filter(
    ([path]) => !path.endsWith("testsAssertKeys.test.ts"),
  );

  it("scans every suite in this folder and the browser suites", () => {
    // A glob that silently stopped matching would make this test pass by
    // finding nothing, which is the one failure mode it cannot report itself.
    expect(files.length).toBeGreaterThan(15);
    expect(files.some(([path]) => path.startsWith("../../e2e/"))).toBe(true);
  });

  it.each(files)("%s quotes no bundle value", (path, source) => {
    const file = path.replace(/^(\.\/|\.\.\/\.\.\/)/, "");
    const offenders = literalsIn(source)
      .map(({ line, text }) => ({ line, text: text.trim() }))
      .filter(({ text }) => KEYS_BY_VALUE.has(text))
      // Contract vocabulary, not copy: `READER`, `UPSTREAM_UNAVAILABLE`.
      .filter(({ text }) => !/^[A-Z0-9_.-]+$/.test(text))
      // Punctuation is typography, not copy: a dash placeholder has no key.
      .filter(({ text }) => /\p{L}/u.test(text))
      .filter(({ text }) => !NOT_COPY.has(`${file}:${text}`))
      .map(
        ({ line, text }) =>
          `${file}:${line} quotes "${text}" — assert ` +
          KEYS_BY_VALUE.get(text)!
            .map((key) => `t("${key}")`)
            .join(" or "),
      );

    expect(offenders).toEqual([]);
  });
});
