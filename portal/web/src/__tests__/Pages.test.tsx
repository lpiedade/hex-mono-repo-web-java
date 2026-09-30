import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../i18n";
import { App } from "../App";
import { getApiAbout, getBffAbout, getUserContext, listItems } from "../api/client";
import { ApiError } from "../api/errors";
import { About, BuiltAt, display } from "../pages/About";
import { Home } from "../pages/Home";
import { NotFound } from "../pages/NotFound";
import { AppRouter } from "../router";
import { renderWithProviders, t, tRe } from "./test-utils";

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

const BUILD = { version: "1.4.0", commit: "abc1234", builtAt: "2026-09-26T09:14:00Z" };

beforeEach(() => {
  vi.mocked(getUserContext).mockResolvedValue({ schemaVersion: 1, subject: "dev", roles: [] });
  vi.mocked(getBffAbout).mockResolvedValue({
    portalApiVersion: 1,
    build: { version: "2.0.0", commit: "def5678", builtAt: "2026-09-27T10:00:00Z" },
  });
  vi.mocked(getApiAbout).mockResolvedValue({ schemaVersion: 1, build: BUILD });
  vi.mocked(listItems).mockResolvedValue({ schemaVersion: 1, items: [] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Home", () => {
  it("links to the items screen", () => {
    renderWithProviders(<Home />);

    expect(screen.getByRole("heading", { level: 1, name: t("home.title") })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: tRe("home.items.cta") })).toHaveAttribute(
      "href",
      "/items",
    );
  });
});

describe("NotFound", () => {
  it("names the address that matched nothing and offers the way home", () => {
    renderWithProviders(<NotFound />, { initialPath: "/nowhere" });

    expect(screen.getByRole("heading", { level: 1, name: t("notFound.title") })).toBeInTheDocument();
    expect(screen.getByText(t("notFound.body", { path: "/nowhere" }))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t("notFound.home") })).toHaveAttribute("href", "/");
  });
});

describe("About", () => {
  it("shows the build of the portal and of the API, side by side", async () => {
    renderWithProviders(<About />);

    const portal = screen.getByRole("region", { name: t("about.portal") });
    const api = screen.getByRole("region", { name: t("about.api") });
    await waitFor(() => expect(portal).toHaveTextContent("def5678"));
    expect(portal).toHaveTextContent("2.0.0");
    await waitFor(() => expect(api).toHaveTextContent("abc1234"));
    expect(api).toHaveTextContent("1.4.0");
    expect(api.querySelector(`time[datetime="${BUILD.builtAt}"]`)).not.toBeNull();
  });

  it("keeps the portal's answer when the API is down", async () => {
    vi.mocked(getApiAbout).mockRejectedValue(
      new ApiError(503, { code: "UPSTREAM_UNAVAILABLE", correlationId: "corr-a" }),
    );
    renderWithProviders(<About />);

    const api = screen.getByRole("region", { name: t("about.api") });
    await waitFor(() => expect(api).toHaveTextContent(t("error.upstreamUnavailable")));
    expect(screen.getByRole("region", { name: t("about.portal") })).toHaveTextContent("def5678");
  });

  it("never prints the word unknown as a commit", () => {
    expect(display("unknown")).toBe("—");
    expect(display(undefined)).toBe("—");
    expect(display("abc")).toBe("abc");
  });

  it("prints an unparseable timestamp as it arrived", () => {
    render(<BuiltAt iso="yesterday-ish" locale="en-US" />);
    expect(screen.getByText("yesterday-ish")).toBeInTheDocument();
  });

  it("prints a dash for an absent timestamp", () => {
    render(<BuiltAt iso={undefined} locale="en-US" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("the router", () => {
  function renderAt(path: string) {
    return renderWithProviders(
      <AppRouter colorMode="light" onToggleColorMode={() => undefined} />,
      { initialPath: path },
    );
  }

  it.each([
    ["/", "home.title"],
    ["/items", "items.title"],
    ["/build", "about.title"],
    ["/no/such/page", "notFound.title"],
  ])("renders %s inside the shell", async (path, heading) => {
    renderAt(path);

    expect(
      await screen.findByRole("heading", { level: 1, name: t(heading) }),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: t("nav.label") })).toBeInTheDocument();
  });

  it("follows the home page's link to the items", async () => {
    const user = userEvent.setup();
    renderAt("/");

    await user.click(screen.getByRole("link", { name: tRe("home.items.cta") }));

    expect(
      await screen.findByRole("heading", { level: 1, name: t("items.title") }),
    ).toBeInTheDocument();
  });
});

describe("App", () => {
  it("mounts under the /app base path and toggles the theme", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/app/build");
    render(<App />);

    expect(
      await screen.findByRole("heading", { level: 1, name: t("about.title") }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: t("theme.toggleDark") }));
    expect(screen.getByRole("button", { name: t("theme.toggleLight") })).toBeInTheDocument();
    window.history.pushState({}, "", "/");
  });
});
