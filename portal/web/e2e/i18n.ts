/**
 * Resolves an i18n key for a browser suite, so **a browser test asserts the
 * key, not the translation** (portal/CLAUDE.md) on the same terms as the
 * component suite.
 *
 * It reads the bundles off disk rather than going through `src/shared/i18n`: that
 * module initialises i18next against `import.meta.env`, which belongs to Vite
 * and not to the Playwright runner, and a browser suite has no need of a live
 * instance — it needs the string the browser will be showing. `readFileSync`
 * rather than an `import` of the JSON, because Playwright's ESM loader demands
 * an `with { type: "json" }` attribute that the Vitest and Vite sides of this
 * project do not use.
 *
 * Which locale the browser is in is not this file's to know: the SPA picks it
 * from `localStorage` and falls back to `DEFAULT_LOCALE`. So the
 * locale-agnostic {@link tAny} is the default tool here, and {@link t} is for a
 * suite that has pinned the language itself.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LOCALES = ["en-US", "pt-BR"] as const;

export type Locale = (typeof LOCALES)[number];

const LOCALES_DIR = join(dirname(fileURLToPath(import.meta.url)), "../src/shared/i18n/locales");

const BUNDLES = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    JSON.parse(readFileSync(join(LOCALES_DIR, `${locale}.json`), "utf8")) as unknown,
  ]),
) as Record<Locale, unknown>;

function resolve(locale: Locale, key: string, vars: Record<string, string>): string {
  const value = key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined,
      BUNDLES[locale],
    );
  if (typeof value !== "string") {
    // Louder than i18next's own behavior on purpose: rendering the key would
    // let an assertion compare a key against a key and pass.
    throw new Error(`i18n key "${key}" is not a string in ${locale}`);
  }
  return value.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => vars[name] ?? "");
}

/** One locale's rendering of `key`, with `{{name}}` placeholders filled from `vars`. */
export function t(
  key: string,
  locale: Locale = "en-US",
  vars: Record<string, string> = {},
): string {
  return resolve(locale, key, vars);
}

/**
 * Every locale's rendering of `key`, as one case-insensitive alternation, so a
 * suite matches whichever locale the browser picked without hand-writing the
 * alternatives.
 */
export function tAny(key: string, vars: Record<string, string> = {}): RegExp {
  return new RegExp(alternatives(key, vars).join("|"), "i");
}

/**
 * {@link tAny}, anchored — the `exact: true` a string locator would have had.
 * Playwright ignores `exact` for a `RegExp`, so the anchors have to be in the
 * pattern.
 */
export function tAnyExact(key: string, vars: Record<string, string> = {}): RegExp {
  return new RegExp(`^(${alternatives(key, vars).join("|")})$`, "i");
}

function alternatives(key: string, vars: Record<string, string>): string[] {
  return LOCALES.map((locale) =>
    resolve(locale, key, vars).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  ).filter((value, index, all) => all.indexOf(value) === index);
}
