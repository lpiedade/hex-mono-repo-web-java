import { describe, expect, it } from "vitest";

/**
 * Who reports their own failures, and who the global net is carrying.
 *
 * A mutation is reported globally unless its screen declares
 * `meta: REPORTED_INLINE`. That makes forgetting produce a *duplicate* report —
 * visible, and caught in review — rather than silence.
 *
 * This test pins the other half: the set of mutations deliberately left to the
 * net. Add a mutation without `meta` and the set grows and this fails, which
 * forces the decision to be made rather than defaulted into — either the screen
 * reports it inline, or it is listed here on purpose.
 *
 * **What it does not catch**, stated rather than implied: a mutation that keeps
 * its `meta` after its inline banner is deleted. That direction restores
 * silence, and only the error net's behavioral suites plus review stand
 * against it.
 */

/**
 * Every production module, wherever it lives: rooted at the project rather
 * than at this file, so moving code between folders cannot take a mutation out
 * of the scan. Suites and the test harness are not portal surface — their
 * throwaway mutations are theirs.
 */
const sources = import.meta.glob<string>(
  ["/src/**/*.{ts,tsx}", "!/src/**/__tests__/**", "!/src/**/*.d.ts", "!/src/shared/testing/**"],
  { query: "?raw", eager: true, import: "default" },
);

/**
 * How many production modules the scan must at least see — the count when it
 * was last checked, a floor and not a target. A glob that silently stopped
 * matching would make every assertion below vacuous.
 */
const MINIMUM_MODULES = 72;

/**
 * `const fooMutation = useMutation({` and whether the next line marks it.
 * Deliberately naive — so every other `useMutation(` in the source is counted
 * as well, and a mutation written in another shape fails the suite instead of
 * slipping past the matcher.
 */
function mutationsIn(source: string): { name: string; marked: boolean }[] {
  const found: { name: string; marked: boolean }[] = [];
  const pattern = /const (\w+) = useMutation\(\{\s*\n(\s*meta: REPORTED_INLINE,)?/g;
  for (const match of source.matchAll(pattern)) {
    found.push({ name: match[1], marked: match[2] !== undefined });
  }
  return found;
}

function useMutationCallsIn(source: string): number {
  return [...source.matchAll(/\buseMutation\(/g)].length;
}

/**
 * Mutations the global net reports, because their screen renders nothing.
 * Each entry is `<file>:<const name>` and needs a reason beside it.
 */
const CARRIED_BY_THE_NET: string[] = [];

describe("the error-reporting inventory", () => {
  const modules = Object.entries(sources);
  const all = modules.flatMap(([path, source]) =>
    mutationsIn(source).map((m) => ({ id: `${path.slice(1)}:${m.name}`, marked: m.marked })),
  );

  it("scans every production module", () => {
    expect(modules.length).toBeGreaterThanOrEqual(MINIMUM_MODULES);
  });

  /* A matcher that silently found nothing would make the assertions vacuous. */
  it("finds the portal's mutations", () => {
    expect(all.map((m) => m.id)).toEqual(
      expect.arrayContaining([
        "src/features/edit-item/ui/ItemDialog.tsx:saveMutation",
        "src/features/delete-item/ui/DeleteItemDialog.tsx:deleteMutation",
      ]),
    );
  });

  it("recognizes every useMutation call, so none escapes the inventory", () => {
    const unrecognized = modules
      .filter(([, source]) => useMutationCallsIn(source) !== mutationsIn(source).length)
      .map(([path]) => path.slice(1));
    expect(
      unrecognized,
      "a useMutation the inventory cannot read: write it as " +
        "`const <name>Mutation = useMutation({` with `meta:` first when it has one",
    ).toEqual([]);
  });

  it("carries exactly the mutations recorded as unreported", () => {
    const unmarked = all
      .filter((m) => !m.marked)
      .map((m) => m.id)
      .sort();
    expect(
      unmarked,
      "a mutation with no inline report and no entry in CARRIED_BY_THE_NET: " +
        "either render its error, or list it here on purpose",
    ).toEqual([...CARRIED_BY_THE_NET].sort());
  });

  it("records no mutation that has since been marked", () => {
    const marked = new Set(all.filter((m) => m.marked).map((m) => m.id));
    const stale = CARRIED_BY_THE_NET.filter((id) => marked.has(id));
    expect(stale, "listed as unreported but now marked REPORTED_INLINE").toEqual([]);
  });
});
