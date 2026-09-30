import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enUS from "./locales/en-US.json";
import ptBR from "./locales/pt-BR.json";

// Locales the portal supports (portal/CLAUDE.md). Every user-facing key must
// exist in each bundle; locales.test.ts enforces parity. Adding a locale is a
// new bundle, an entry here, one in `resources` below, and its autonym in
// `LanguageSelector`.
export const SUPPORTED_LOCALES = ["en-US", "pt-BR"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en-US";

// Where the user's runtime language choice is persisted across sessions.
export const LOCALE_STORAGE_KEY = "app.locale";

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

function initialLocale(): SupportedLocale {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isSupportedLocale(saved)) {
      return saved;
    }
  } catch {
    // localStorage may be unavailable (private mode); fall back to the default.
  }
  return DEFAULT_LOCALE;
}

/** Persist the user's language choice; ignores storage failures. */
export function persistLocale(locale: SupportedLocale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Non-fatal: the choice simply will not survive a reload.
  }
}

/**
 * An unresolved key is a defect, not UI text.
 *
 * i18next's default for a key it cannot resolve is to render the key itself,
 * and with no `saveMissing` there is not even a console line — so a status
 * interpolated from an `undefined` value reaches the screen as a dotted
 * identifier and nothing reports it.
 *
 * Development only, and that is the whole point of the flag. In production this
 * adds no console output and no visible diagnostic: a user gains nothing from a
 * key name, `locales.test.ts` already holds the bundles to one key set, and
 * turning a missing key into a runtime throw would make a translation gap an
 * outage.
 */
const missingKeys = new Set<string>();

export function reportMissingKey(locales: readonly string[], key: string): void {
  // Deduplicated: a missing key in a list row would otherwise log once per row
  // and bury whatever else the console was saying.
  const seen = `${locales.join(",")}:${key}`;
  if (missingKeys.has(seen)) return;
  missingKeys.add(seen);
  console.error(
    `[portal] missing i18n key "${key}" for ${locales.join(", ")} — ` +
      "it rendered as its own name. Add it to every bundle.",
  );
}

/** Test seam, so one suite's missing key does not silence the next one's. */
export function resetMissingKeyReports(): void {
  missingKeys.clear();
}

// The document's language is what a screen reader picks its voice by, so it
// follows the active locale rather than staying whatever index.html declared.
i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
});

// The bundles are passed in, so initialization completes synchronously and the
// returned promise carries nothing to wait for.
void i18n.use(initReactI18next).init({
  resources: {
    "en-US": { translation: enUS },
    "pt-BR": { translation: ptBR },
  },
  lng: initialLocale(),
  fallbackLng: DEFAULT_LOCALE,
  interpolation: { escapeValue: false },
  saveMissing: import.meta.env.DEV,
  missingKeyHandler: (locales, _namespace, key) => {
    reportMissingKey(locales, key);
  },
});

export default i18n;
