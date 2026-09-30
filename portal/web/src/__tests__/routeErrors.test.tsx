import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { createMemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { browser } from "../api/auth";
import { getUserContext, listItems } from "../api/client";
import { reportError, resetErrorReporting } from "../api/errorReporting";
import { ApiError } from "../api/errors";
import { routes } from "../router";
import { expectConsole } from "../test-setup";
import { renderRoutes, t } from "./test-utils";

/**
 * A screen that throws must not take the document down with it (ADR-013, "no
 * failure is silent"). Each route's `errorElement` replaces the screen inside
 * the shell; the root route's replaces the shell when the shell itself fails.
 *
 * The components are the real ones, made to fail on demand: a flag per
 * failure, read at render (or, for the lazily loaded screen, when its module
 * is read), so one file covers every way through the tree.
 */
const failing = vi.hoisted(() => ({ shell: false, home: false, buildChunk: false }));

/** What a thrown error carries that must never reach the screen. */
const INTERNALS = "at render (/srv/internal/Home.tsx:12:7)";

vi.mock("../layout/Shell", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../layout/Shell")>();
  return {
    Shell: (props: ComponentProps<typeof actual.Shell>) => {
      if (failing.shell) throw new Error(`shell failed ${INTERNALS}`);
      return <actual.Shell {...props} />;
    },
  };
});

vi.mock("../pages/Home", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../pages/Home")>();
  return {
    Home: () => {
      if (failing.home) throw new Error(`home failed ${INTERNALS}`);
      return <actual.Home />;
    },
  };
});

vi.mock("../pages/About", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../pages/About")>();
  return {
    ...actual,
    // Read by the route's `lazy` — the moment a chunk that failed to download
    // would reject.
    get About() {
      if (failing.buildChunk) throw new TypeError("Failed to fetch dynamically imported module");
      return actual.About;
    },
  };
});

vi.mock("../api/client", () => ({
  getUserContext: vi.fn(),
  logout: vi.fn(),
  listItems: vi.fn(),
  getBffAbout: vi.fn(),
  getApiAbout: vi.fn(),
}));

beforeEach(() => {
  failing.shell = false;
  failing.home = false;
  failing.buildChunk = false;
  resetErrorReporting();
  vi.mocked(getUserContext).mockResolvedValue({ schemaVersion: 1, subject: "dev", roles: [] });
  vi.mocked(listItems).mockResolvedValue({ schemaVersion: 1, items: [] });
});

describe("a screen that fails to render", () => {
  beforeEach(() => {
    failing.home = true;
    // React and React Router both log the caught error — for the developer.
    expectConsole("error");
  });

  it("is replaced by the error page, inside the shell", async () => {
    renderRoutes(routes, { initialPath: "/" });

    expect(
      await screen.findByRole("heading", { level: 1, name: t("routeError.title") }),
    ).toBeInTheDocument();
    expect(screen.getByText(t("routeError.body"))).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: t("nav.label") })).toBeInTheDocument();
  });

  it("shows no part of the error itself", async () => {
    renderRoutes(routes, { initialPath: "/" });
    await screen.findByRole("heading", { level: 1, name: t("routeError.title") });

    expect(document.body).not.toHaveTextContent(/home failed|\/srv\/internal/);
  });

  it("offers a reload", async () => {
    const user = userEvent.setup();
    const reload = vi.spyOn(browser, "reload").mockImplementation(() => undefined);
    renderRoutes(routes, { initialPath: "/" });

    await user.click(await screen.findByRole("button", { name: t("routeError.reload") }));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("offers the way home, and leaves every other page reachable", async () => {
    const user = userEvent.setup();
    renderRoutes(routes, { initialPath: "/" });

    expect(await screen.findByRole("link", { name: t("routeError.home") })).toHaveAttribute(
      "href",
      "/",
    );
    await user.click(screen.getByRole("link", { name: t("nav.items") }));

    expect(
      await screen.findByRole("heading", { level: 1, name: t("items.title") }),
    ).toBeInTheDocument();
  });

  it("leaves the global error report working", async () => {
    render(<App router={createMemoryRouter(routes, { initialEntries: ["/"] })} />);
    await screen.findByRole("heading", { level: 1, name: t("routeError.title") });

    // Reported from outside React, as a mutation's cache does; the snackbar's
    // state change is flushed inside act before it is asserted.
    act(() => {
      reportError(
        new ApiError(409, { detail: "Conflict", code: "ITEM_NAME_EXISTS", correlationId: "c-1" }),
        "mutation",
      );
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("c-1");
  });
});

describe("a screen whose code fails to load", () => {
  it("gets the same error page, inside the shell", async () => {
    failing.buildChunk = true;
    // React Router logs the rejected import.
    expectConsole("error");
    renderRoutes(routes, { initialPath: "/build" });

    expect(
      await screen.findByRole("heading", { level: 1, name: t("routeError.title") }),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: t("nav.label") })).toBeInTheDocument();
  });
});

describe("a shell that fails to render", () => {
  beforeEach(() => {
    failing.shell = true;
    expectConsole("error");
  });

  it("is replaced by a page of its own, with its own landmark and title", async () => {
    renderRoutes(routes, { initialPath: "/items" });

    expect(
      await screen.findByRole("heading", { level: 1, name: t("routeError.title") }),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("routeError.reload") })).toBeInTheDocument();
    await waitFor(() =>
      expect(document.title).toBe(
        t("app.documentTitle", { page: t("routeError.title"), app: t("app.name") }),
      ),
    );
  });
});
