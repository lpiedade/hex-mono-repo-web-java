import { describe, expect, it } from "vitest";
import { BUNDLES, SUPPORTED_LOCALES } from "@/shared/i18n";

/**
 * Enforces the portal/CLAUDE.md i18n rule: a key present in one bundle but
 * missing from another is a defect. This locks every bundle to the same key set
 * so translations cannot silently drift.
 */

/** The bundle files on disk, by locale: a file nobody registered is caught too. */
const BUNDLE_FILES = Object.keys(import.meta.glob("/src/shared/i18n/locales/*.json")).map((path) =>
  path.replace(/^.*\/(.+)\.json$/, "$1"),
);
type Json = { [key: string]: string | Json };

function flatten(obj: Json, prefix = ""): [string, string][] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "object" && value !== null
      ? flatten(value, path)
      : ([[path, value]] as [string, string][]);
  });
}

const bundles: Record<string, Json> = BUNDLES;

describe("locale bundles", () => {
  const reference = flatten(bundles["en-US"])
    .map(([k]) => k)
    .sort();

  it("exist for exactly the supported locales, one file each", () => {
    expect([...BUNDLE_FILES].sort()).toEqual([...SUPPORTED_LOCALES].sort());
    expect(Object.keys(bundles).sort()).toEqual([...SUPPORTED_LOCALES].sort());
  });

  it.each(Object.keys(bundles))("%s has the same keys as en-US", (locale) => {
    const keys = flatten(bundles[locale])
      .map(([k]) => k)
      .sort();
    expect(keys).toEqual(reference);
  });

  it.each(Object.entries(bundles))("%s has no empty values", (_locale, bundle) => {
    for (const [path, value] of flatten(bundle)) {
      expect(value.trim(), path).not.toBe("");
    }
  });
});
