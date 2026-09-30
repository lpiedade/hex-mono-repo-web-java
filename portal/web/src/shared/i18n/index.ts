/**
 * Public API of `shared/i18n` — the i18next instance, initialized on import
 * with every bundle in `locales/`, and the locale helpers around it.
 *
 * The initialization lives here rather than in `app/` because every layer's
 * components render copy through react-i18next and every suite needs the
 * instance ready: an `app`-owned init would make a `shared/ui` suite import
 * `app`, which the layering forbids (ADR-027). It knows nothing app-specific —
 * only the bundles, which are shared.
 */
export {
  BUNDLES,
  DEFAULT_LOCALE,
  i18n,
  isSupportedLocale,
  LOCALE_STORAGE_KEY,
  persistLocale,
  reportMissingKey,
  resetMissingKeyReports,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "./i18n";
