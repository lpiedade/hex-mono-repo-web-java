// @vitest-environment node
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

/**
 * The layering rules (ADR-027) can fire.
 *
 * `npm run lint` enforces them with eslint-plugin-boundaries, and a rule that
 * silently stopped reporting — a changed pattern, a resolver that no longer
 * resolves `@/`, a policy deleted in a refactor — would leave a green lint over
 * a tree that no longer honours them. So each rule is shown firing against a
 * violation planted for it, through the project's own `eslint.config.js`, the
 * way the backend's `ArchitectureTest` proves each ArchUnit rule against its
 * planted fixtures. A clean import is linted too, so the rules cannot pass
 * this suite by reporting everything.
 *
 * The violations are linted as the text of an existing file of the slice they
 * are planted in (`lintText` with that file's path), so nothing is written to
 * the tree.
 *
 * That only works if the parser reads the text it is given. typescript-eslint
 * switches to "single run" mode by itself when `CI=true` — as on GitHub
 * Actions — and then parses each file's content *from disk*, so every planted
 * violation would be replaced by the clean file and the suite would fail in CI
 * alone. `disallowAutomaticSingleRunInference` keeps this suite's parser on the
 * text; `npm run lint`, which lints real files, is unaffected either way.
 */

/** portal/web/, from src/app/__tests__/guards/. */
const PROJECT = decodeURIComponent(new URL("../../../../", import.meta.url).pathname);

const eslint = new ESLint({
  cwd: PROJECT,
  overrideConfig: {
    languageOptions: { parserOptions: { disallowAutomaticSingleRunInference: true } },
  },
});

/** The boundaries findings for `code` linted as the content of `file`, as `rule: message`. */
async function boundaryFindings(file: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: `${PROJECT}${file}` });
  return result.messages
    .filter((message) => message.ruleId?.startsWith("boundaries/"))
    .map((message) => `${message.ruleId}: ${message.message}`);
}

/** The two policies of `boundaries/dependencies`, told apart by their messages. */
const LAYERING = /^boundaries\/dependencies: A layer imports only the layers below it/;
const PUBLIC_API = /^boundaries\/dependencies: Import a slice or segment through its public API/;

const PLANTED = [
  {
    violation: "an upward import (entities → features)",
    file: "src/entities/item/index.ts",
    code: 'export { ItemDialog } from "@/features/edit-item";\n',
    policy: LAYERING,
  },
  {
    violation: "an upward import out of shared (shared → entities)",
    file: "src/shared/ui/index.ts",
    code: 'export { itemKeys } from "@/entities/item";\n',
    policy: LAYERING,
  },
  {
    violation: "an import between two slices of one layer (features → features)",
    file: "src/features/delete-item/index.ts",
    code: 'export { ItemDialog } from "@/features/edit-item";\n',
    policy: LAYERING,
  },
  {
    violation: "a deep import that bypasses a slice's index.ts",
    file: "src/pages/home/index.ts",
    code: 'export { itemQueries } from "@/entities/item/api/itemQueries";\n',
    policy: PUBLIC_API,
  },
  {
    violation: "a deep import that bypasses a shared segment's index.ts",
    file: "src/features/logout/index.ts",
    code: 'export { logout } from "@/shared/api/client";\n',
    policy: PUBLIC_API,
  },
  {
    violation: "a relative deep import into another slice",
    file: "src/pages/items/ui/ItemsPage.tsx",
    code: 'export { validateItem } from "../../../entities/item/model/itemForm";\n',
    policy: PUBLIC_API,
  },
];

describe("the layering rules", { timeout: 120_000 }, () => {
  it.each(PLANTED)("report $violation", async ({ file, code, policy }) => {
    const findings = await boundaryFindings(file, code);
    expect(
      findings.some((finding) => policy.test(finding)),
      findings.join("\n"),
    ).toBe(true);
  });

  it("accept downward imports through public APIs, and a slice's own files", async () => {
    const downward = [
      'export { itemQueries } from "@/entities/item";',
      'export { ItemDialog } from "@/features/edit-item";',
      'export { PageHeader } from "@/shared/ui";',
      'export { ItemsPage } from "./ui/ItemsPage";',
    ].join("\n");

    expect(await boundaryFindings("src/pages/items/index.ts", `${downward}\n`)).toEqual([]);
  });
});
