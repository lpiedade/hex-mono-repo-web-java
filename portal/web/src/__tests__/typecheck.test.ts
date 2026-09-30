import { describe, expect, it } from "vitest";
import pkg from "../../package.json";

/**
 * The documented frontend gate runs the typechecker.
 *
 * Vitest strips types rather than checking them, so `npm test` stays green
 * while a screen reads a field the regenerated contract no longer has. A suite
 * that mocks `api/client` will never notice that; `tsc` notices it the moment
 * the generated types are regenerated, which is why the gate has to invoke it.
 *
 * It is wired as `pretest:coverage` rather than as a test that spawns the
 * compiler: spawning needs `@types/node`, which this project keeps out of
 * `tsconfig.json`'s `types` so browser code cannot reach for Node globals.
 * What is left is that the wiring could be quietly removed, which is what this
 * asserts. `npm test` is deliberately *not* covered: it is the fast inner loop.
 */
describe("the frontend gate", () => {
  it("typechecks before running the coverage suite", () => {
    const scripts = pkg.scripts as Record<string, string | undefined>;

    expect(scripts["pretest:coverage"], "pretest:coverage must invoke the typechecker")
      .toContain("typecheck");
    expect(scripts.typecheck, "typecheck must be tsc --noEmit").toBe("tsc --noEmit");
    // The generated contract types have to exist before `tsc` reads them, so the
    // order of the two halves of the pre-script is load-bearing.
    expect(scripts["pretest:coverage"]?.indexOf("generate:api")).toBeLessThan(
      scripts["pretest:coverage"]?.indexOf("typecheck") ?? -1,
    );
  });

  it("still typechecks as part of the build", () => {
    expect((pkg.scripts as Record<string, string>).build).toContain("tsc --noEmit");
  });
});
