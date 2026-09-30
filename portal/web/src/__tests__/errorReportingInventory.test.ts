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
 * silence, and only `errorReporting.test.tsx`'s behavioral assertions plus
 * review stand against it.
 */

const sources = import.meta.glob<string>("../**/*.tsx", {
  query: "?raw",
  eager: true,
  import: "default",
});

/**
 * `const fooMutation = useMutation({` and whether the next line marks it.
 * Deliberately naive: a mutation written another way should fail loudly here
 * rather than be skipped silently — which is why the total is asserted too.
 */
function mutationsIn(source: string): { name: string; marked: boolean }[] {
  const found: { name: string; marked: boolean }[] = [];
  const pattern = /const (\w+) = useMutation\(\{\s*\n(\s*meta: REPORTED_INLINE,)?/g;
  for (const match of source.matchAll(pattern)) {
    found.push({ name: match[1], marked: match[2] !== undefined });
  }
  return found;
}

/**
 * Mutations the global net reports, because their screen renders nothing.
 * Each entry is `<file>:<const name>` and needs a reason beside it.
 */
const CARRIED_BY_THE_NET: string[] = [];

describe("the error-reporting inventory", () => {
  const all = Object.entries(sources)
    // The glob is rooted at `src/__tests__/`, so a sibling suite appears as
    // `./x.test.tsx` and production files as `../…`. A suite's own throwaway
    // mutations are not portal surface.
    .filter(([path]) => path.startsWith("../"))
    .flatMap(([path, source]) =>
      mutationsIn(source).map((m) => ({
        id: `${path.replace(/^\.\.\//, "src/")}:${m.name}`,
        marked: m.marked,
      })),
    );

  /* A matcher that silently found nothing would make the assertions vacuous. */
  it("finds the portal's mutations", () => {
    expect(all.map((m) => m.id)).toEqual(
      expect.arrayContaining([
        "src/pages/items/ItemDialog.tsx:saveMutation",
        "src/pages/items/ItemsPage.tsx:deleteMutation",
      ]),
    );
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
