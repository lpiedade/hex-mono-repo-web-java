import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, it, expect, vi } from "vitest";
import "../i18n";
import { getUserContext, logout } from "../api/client";
import { Nav } from "../layout/Nav";
import { NAV_ITEMS } from "../layout/navItems";
import { collapseShortcutLabel } from "../layout/navPreferences";
import { setTestViewportWidth } from "../test-setup";
import { renderWithProviders, t, tRe } from "./test-utils";

vi.mock("../api/client", () => ({
  getUserContext: vi.fn(),
  logout: vi.fn(),
}));

const chord = { shortcut: collapseShortcutLabel() };
const destinations = NAV_ITEMS.map((item) => `nav.${item.key}`);

beforeEach(() => {
  vi.mocked(getUserContext).mockResolvedValue({
    schemaVersion: 1,
    subject: "ada.lovelace",
    roles: ["READER", "EDITOR"],
  });
  vi.mocked(logout).mockReset();
});

describe("Nav", () => {
  it("is a navigation landmark with a unique name", () => {
    renderWithProviders(<Nav />);
    expect(screen.getByRole("navigation", { name: t("nav.label") })).toBeInTheDocument();
  });

  it.each(destinations)("links to the %s destination", (key) => {
    renderWithProviders(<Nav />);
    expect(screen.getByRole("link", { name: t(key) })).toBeInTheDocument();
  });

  it("marks the current destination, and only that one", () => {
    renderWithProviders(<Nav />, { initialPath: "/items" });

    expect(screen.getByRole("link", { name: t("nav.items") })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // Home is `/`, a prefix of every path: it must match exactly or it would
    // be marked current everywhere.
    expect(screen.getByRole("link", { name: t("nav.home") })).not.toHaveAttribute("aria-current");
  });

  it("shows the product name beside the mark", () => {
    renderWithProviders(<Nav />);
    expect(screen.getByText(t("app.name"))).toBeInTheDocument();
  });

  describe("the identity card", () => {
    it("shows the subject and the roles from the user context", async () => {
      renderWithProviders(<Nav />);

      expect(await screen.findByText("ada.lovelace")).toBeInTheDocument();
      const roles = screen.getByRole("list", { name: t("identity.roles") });
      expect(roles).toHaveTextContent(t("identity.role.READER"));
      expect(roles).toHaveTextContent(t("identity.role.EDITOR"));
      expect(roles).not.toHaveTextContent(t("identity.role.ADMIN"));
    });

    it("shows a placeholder while the context loads", () => {
      vi.mocked(getUserContext).mockReturnValue(new Promise(() => {}));
      renderWithProviders(<Nav />);

      expect(screen.getByText(t("identity.loading"))).toBeInTheDocument();
    });

    it("signs out", async () => {
      renderWithProviders(<Nav />);

      await userEvent.click(screen.getByRole("button", { name: t("identity.signOut") }));

      expect(logout).toHaveBeenCalled();
    });
  });

  describe("collapsed", () => {
    it("keeps every destination, named by its tooltip", () => {
      renderWithProviders(<Nav collapsed onToggleCollapsed={() => undefined} />);

      for (const key of destinations) {
        expect(screen.getByRole("link", { name: t(key) })).toBeInTheDocument();
      }
      expect(screen.queryByText(t("app.name"))).not.toBeInTheDocument();
    });

    it("replaces the identity card with a sign-out control", async () => {
      renderWithProviders(<Nav collapsed onToggleCollapsed={() => undefined} />);

      expect(screen.queryByRole("region", { name: t("identity.label") })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: t("identity.signOut") }));
      expect(logout).toHaveBeenCalled();
    });

    it("offers a toggle that names the chord it shares with the keyboard", async () => {
      const onToggleCollapsed = vi.fn();
      renderWithProviders(<Nav collapsed onToggleCollapsed={onToggleCollapsed} />);

      const toggle = screen.getByRole("button", { name: tRe("nav.expand", chord) });
      expect(toggle).toHaveAttribute("aria-keyshortcuts");
      await userEvent.click(toggle);

      expect(onToggleCollapsed).toHaveBeenCalled();
    });

    it("drops the printed chord, where there is no room for it", () => {
      renderWithProviders(<Nav collapsed onToggleCollapsed={() => undefined} />);

      expect(screen.queryByText(chord.shortcut)).not.toBeInTheDocument();
    });
  });

  it("prints the chord beside the expanded control, hidden from assistive tech", () => {
    renderWithProviders(<Nav onToggleCollapsed={() => undefined} />);

    const printed = screen.getByText(chord.shortcut);
    // Decorative: the chord is already in the button's own name.
    expect(printed).toHaveAttribute("aria-hidden");
  });

  /**
   * A 264px permanent rail leaves 56px of content at a 320px viewport, which
   * would force the document to scroll horizontally (WCAG 2.2 SC 1.4.10). The
   * rail becomes a temporary drawer below `sm` — the destinations move, they
   * are not dropped.
   */
  describe("at a narrow viewport", () => {
    it("hides the destinations behind the drawer until it is opened", () => {
      setTestViewportWidth(320);
      renderWithProviders(<Nav mobileOpen={false} />);

      expect(screen.queryByRole("link", { name: t("nav.home") })).not.toBeInTheDocument();
    });

    it.each(destinations)("still offers the %s destination once opened", (key) => {
      setTestViewportWidth(320);
      renderWithProviders(<Nav mobileOpen />);

      expect(screen.getByRole("link", { name: t(key) })).toBeInTheDocument();
    });

    it("closes when a destination is followed", async () => {
      setTestViewportWidth(320);
      const onMobileClose = vi.fn();
      renderWithProviders(<Nav mobileOpen onMobileClose={onMobileClose} />);

      await userEvent.click(screen.getByRole("link", { name: t("nav.items") }));

      expect(onMobileClose).toHaveBeenCalled();
    });

    it("offers no collapse control, since the overlay has no width to save", () => {
      setTestViewportWidth(320);
      renderWithProviders(<Nav mobileOpen collapsed onToggleCollapsed={() => undefined} />);

      expect(
        screen.queryByRole("button", { name: tRe("nav.collapse", chord) }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: tRe("nav.expand", chord) }),
      ).not.toBeInTheDocument();
      // And the destinations keep their labels: the drawer is never icons-only.
      expect(screen.getByText(t("nav.items"))).toBeInTheDocument();
    });

    it("clears the open flag when the viewport widens past the breakpoint", () => {
      // Rendering wide from the start would assert only the mount-time effect,
      // not the transition.
      const onMobileClose = vi.fn();
      setTestViewportWidth(320);
      const { rerender } = renderWithProviders(<Nav mobileOpen onMobileClose={onMobileClose} />);
      expect(onMobileClose).not.toHaveBeenCalled();

      setTestViewportWidth(1280);
      rerender(<Nav mobileOpen onMobileClose={onMobileClose} />);

      expect(onMobileClose).toHaveBeenCalled();
    });

    it("keeps the permanent rail from the tablet breakpoint up", () => {
      setTestViewportWidth(768);
      renderWithProviders(<Nav mobileOpen={false} />);

      expect(screen.getByRole("link", { name: t("nav.home") })).toBeInTheDocument();
    });
  });
});
