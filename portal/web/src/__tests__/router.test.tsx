import { act, cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RouteObject } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import indexHtml from "../../index.html?raw";
import { getApiAbout, getBffAbout, getUserContext, listItems } from "../api/client";
import type { RouteHandle } from "../hooks/useDocumentTitle";
import i18n, { DEFAULT_LOCALE } from "../i18n";
import { routes } from "../router";
import { renderRoutes, t } from "./test-utils";

vi.mock("../api/client", () => ({
  getUserContext: vi.fn(),
  logout: vi.fn(),
  getBffAbout: vi.fn(),
  getApiAbout: vi.fn(),
  listItems: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
}));

const BUILD = { version: "1.0.0", commit: "abc1234", builtAt: "2026-09-26T09:14:00Z" };

beforeEach(() => {
  vi.mocked(getUserContext).mockResolvedValue({ schemaVersion: 1, subject: "dev", roles: [] });
  vi.mocked(getBffAbout).mockResolvedValue({ portalApiVersion: 1, build: BUILD });
  vi.mocked(getApiAbout).mockResolvedValue({ schemaVersion: 1, build: BUILD });
  vi.mocked(listItems).mockResolvedValue({ schemaVersion: 1, items: [] });
});

/** The document title a page should carry: "<page> · <app>", in a locale. */
function documentTitle(pageKey: string, lng: string = DEFAULT_LOCALE): string {
  return t("app.documentTitle", { page: t(pageKey, { lng }), app: t("app.name", { lng }), lng });
}

/** The routes the shell hosts — the pages. */
function pages(): RouteObject[] {
  return routes.flatMap((route) => route.children ?? []);
}

describe("the route tree", () => {
  it("has a root error element, for when the shell itself fails", () => {
    expect(routes).toHaveLength(1);
    expect(routes[0].errorElement).toBeTruthy();
  });

  it.each(pages().map((route) => [route.path ?? "(index)", route] as const))(
    "gives %s an error element and a title that resolves",
    (_path, route) => {
      expect(
        route.errorElement,
        "a page without an error element takes the shell down",
      ).toBeTruthy();
      const { titleKey } = route.handle as RouteHandle;
      // `t` throws on a key the bundles do not resolve.
      expect(t(titleKey)).not.toBe("");
    },
  );
});

describe("each route", () => {
  it.each([
    ["/", "home.title"],
    ["/items", "items.title"],
    ["/build", "about.title"],
    ["/no/such/page", "notFound.title"],
  ])("renders %s inside the shell, and titles the document after it", async (path, key) => {
    renderRoutes(routes, { initialPath: path });

    expect(await screen.findByRole("heading", { level: 1, name: t(key) })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: t("nav.label") })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe(documentTitle(key)));
  });
});

describe("navigating", () => {
  afterEach(async () => {
    // Unmount before resetting the global locale, so nothing re-renders.
    cleanup();
    await i18n.changeLanguage(DEFAULT_LOCALE);
  });

  it("loads a lazily split screen and retitles the document", async () => {
    const user = userEvent.setup();
    renderRoutes(routes, { initialPath: "/" });
    await screen.findByRole("heading", { level: 1, name: t("home.title") });

    await user.click(screen.getByRole("link", { name: t("nav.items") }));

    expect(
      await screen.findByRole("heading", { level: 1, name: t("items.title") }),
    ).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe(documentTitle("items.title")));
    expect(screen.queryByRole("progressbar", { name: t("app.contentLoading") })).toBeNull();
  });

  it("retitles the document when the language changes", async () => {
    renderRoutes(routes, { initialPath: "/build" });
    await screen.findByRole("heading", { level: 1, name: t("about.title") });

    // The locale is changed outside React, so the re-render it causes is
    // awaited inside act before anything is asserted.
    await act(() => i18n.changeLanguage("pt-BR"));

    expect(document.title).toBe(documentTitle("about.title", "pt-BR"));
  });
});

describe("index.html", () => {
  it("defaults the title to the default locale's application name", () => {
    const title = /<title>([^<]*)<\/title>/.exec(indexHtml)?.[1];
    expect(title).toBe(t("app.name", { lng: DEFAULT_LOCALE }));
  });
});
