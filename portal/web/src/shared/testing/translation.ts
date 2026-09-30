import { i18n } from "@/shared/i18n";

/**
 * Resolves an i18n key the way the component under test will resolve it.
 *
 * **A test asserts the key, not the translation** (portal/CLAUDE.md). Writing
 * `getByRole("link", { name: "Itens" })` couples the suite to one locale's
 * copy: a reviewer who improves a label has to find and edit every test that
 * quoted the old wording. Going through this helper makes the assertion say
 * what it means — *this element is labelled by `nav.items`* — and copy edits
 * then touch the bundles alone.
 *
 * It resolves through the live i18next instance rather than a snapshot, so a
 * test that switches language sees the language it just switched to.
 * `options` reaches i18next untouched, which covers interpolation
 * (`t("items.edit", { name })`) and, through i18next's own `lng`, a locale
 * asserted explicitly (`t("nav.items", { lng: "pt-BR" })`).
 *
 * An unresolved key throws instead of returning the key itself. i18next renders
 * a missing key as its own name, which in an assertion would compare a key
 * against a key and pass.
 */
export function t(key: string, options?: Record<string, unknown>): string {
  const resolved = i18n.t(key, options ?? {});
  if (resolved === key) {
    throw new Error(
      `i18n key "${key}" resolves to nothing — the test would assert the key ` +
        "against itself and pass. Check the spelling, or add the key to every bundle.",
    );
  }
  return resolved;
}

/**
 * {@link t} as a case-insensitive `RegExp`, for the substring matches Testing
 * Library's `name` option takes. The resolved copy is escaped, so a label
 * carrying `(`, `.` or `?` matches literally rather than as a pattern.
 */
export function tRe(key: string, options?: Record<string, unknown>): RegExp {
  return new RegExp(tPattern(key, options), "i");
}

/** {@link tRe}, anchored — for a short label that is a prefix of a longer one. */
export function tReExact(key: string, options?: Record<string, unknown>): RegExp {
  return new RegExp(`^${tPattern(key, options)}$`, "i");
}

/**
 * The `RegExp`-safe form of a resolved key, for a name the component
 * *composes* rather than renders whole.
 */
export function tPattern(key: string, options?: Record<string, unknown>): string {
  return t(key, options).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
