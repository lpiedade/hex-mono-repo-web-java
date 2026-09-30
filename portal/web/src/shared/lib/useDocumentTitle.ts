import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMatches } from "react-router-dom";

/** What a route declares in its `handle` (`router.tsx`). */
export interface RouteHandle {
  /** The i18n key of the page's name, which the document title leads with. */
  titleKey: string;
}

function titleKeyOf(handle: unknown): string | undefined {
  if (handle && typeof handle === "object" && "titleKey" in handle) {
    const { titleKey } = handle;
    return typeof titleKey === "string" ? titleKey : undefined;
  }
  return undefined;
}

/**
 * Sets `document.title` to "<page> · <app>" in the active locale, or to the
 * application's name alone when there is no page.
 *
 * The title is what a browser tab, the history list and a screen reader
 * announce on arrival, so it is copy like any other (WCAG 2.4.2, ADR-013). It
 * follows a language change without anything extra: `useTranslation`
 * re-renders its caller on `languageChanged`, the resolved title changes, and
 * the effect writes it.
 */
export function useDocumentTitle(page: string | undefined): void {
  const { t } = useTranslation();
  const app = t("app.name");
  const title = page ? t("app.documentTitle", { page, app }) : app;

  useEffect(() => {
    document.title = title;
  }, [title]);
}

/**
 * The document title of the current route: the deepest matched route that
 * declares a `titleKey` names the page.
 */
export function useRouteTitle(): void {
  const { t } = useTranslation();
  const titleKey = useMatches()
    .map((match) => titleKeyOf(match.handle))
    .filter((key): key is string => key !== undefined)
    .at(-1);

  useDocumentTitle(titleKey ? t(titleKey) : undefined);
}
