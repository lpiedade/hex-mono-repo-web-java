import { render, screen, waitFor } from "@testing-library/react";
import { Outlet, type RouteObject } from "react-router-dom";
import { describe, expect, it } from "vitest";
import "@/shared/i18n";
import { useDocumentTitle, useRouteTitle } from "../useDocumentTitle";
import { renderRoutes, t } from "@/shared/testing";

/**
 * The document title is copy: what a tab, the history list and a screen reader
 * announce on arrival (WCAG 2.4.2). The route tree's own titles are asserted in
 * `router.test.tsx`; this is the hook's contract.
 */
function PageTitle({ page }: { page?: string }) {
  useDocumentTitle(page);
  return null;
}

function RouteTitle() {
  useRouteTitle();
  return <Outlet />;
}

describe("useDocumentTitle", () => {
  it("leads with the page and ends with the application", async () => {
    render(<PageTitle page="Quarterly figures" />);

    await waitFor(() =>
      expect(document.title).toBe(
        t("app.documentTitle", { page: "Quarterly figures", app: t("app.name") }),
      ),
    );
  });

  it("is the application's name alone when there is no page", async () => {
    render(<PageTitle />);

    await waitFor(() => expect(document.title).toBe(t("app.name")));
  });
});

describe("useRouteTitle", () => {
  const tree: RouteObject[] = [
    {
      element: <RouteTitle />,
      handle: { titleKey: "home.title" },
      children: [
        { path: "declared", handle: { titleKey: "items.title" }, element: <p>declared</p> },
        { path: "inherits", element: <p>inherits</p> },
        { path: "malformed", handle: { titleKey: 42 }, element: <p>malformed</p> },
      ],
    },
  ];

  function titled(key: string): string {
    return t("app.documentTitle", { page: t(key), app: t("app.name") });
  }

  it("takes the title of the deepest route that declares one", async () => {
    renderRoutes(tree, { initialPath: "/declared" });

    await screen.findByText("declared");
    await waitFor(() => expect(document.title).toBe(titled("items.title")));
  });

  it("falls back to the nearest ancestor's title", async () => {
    renderRoutes(tree, { initialPath: "/inherits" });

    await screen.findByText("inherits");
    await waitFor(() => expect(document.title).toBe(titled("home.title")));
  });

  it("ignores a handle whose title key is not a string", async () => {
    renderRoutes(tree, { initialPath: "/malformed" });

    await screen.findByText("malformed");
    await waitFor(() => expect(document.title).toBe(titled("home.title")));
  });

  it("is the application's name when no route declares a title", async () => {
    renderRoutes([{ element: <RouteTitle />, children: [{ index: true, element: <p>bare</p> }] }]);

    await screen.findByText("bare");
    await waitFor(() => expect(document.title).toBe(t("app.name")));
  });
});
