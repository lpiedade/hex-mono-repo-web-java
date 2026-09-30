import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "../i18n";
import enUS from "../locales/en-US.json";
import ptBR from "../locales/pt-BR.json";

/**
 * Enforces the portal/CLAUDE.md i18n rule: a key present in one bundle but
 * missing from another is a defect. This locks every bundle to the same key set
 * so translations cannot silently drift.
 */
type Json = { [key: string]: string | Json };

function flatten(obj: Json, prefix = ""): [string, string][] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "object" && value !== null
      ? flatten(value, path)
      : ([[path, value]] as [string, string][]);
  });
}

const bundles: Record<string, Json> = {
  "en-US": enUS as Json,
  "pt-BR": ptBR as Json,
};

describe("locale bundles", () => {
  const reference = flatten(bundles["en-US"]).map(([k]) => k).sort();

  it("exist for exactly the supported locales", () => {
    expect(Object.keys(bundles).sort()).toEqual([...SUPPORTED_LOCALES].sort());
  });

  it.each(Object.keys(bundles))("%s has the same keys as en-US", (locale) => {
    const keys = flatten(bundles[locale]).map(([k]) => k).sort();
    expect(keys).toEqual(reference);
  });

  it.each(Object.entries(bundles))("%s has no empty values", (_locale, bundle) => {
    for (const [path, value] of flatten(bundle)) {
      expect(value.trim(), path).not.toBe("");
    }
  });
});
