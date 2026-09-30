import { screen } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import "@/shared/i18n";
import { getUserContext } from "@/shared/api";
import { Shell } from "../ui/Shell";
import { renderWithProviders, t, tRe } from "@/shared/testing";

vi.mock("@/shared/api/client", () => ({
  getUserContext: vi.fn(),
  logout: vi.fn(),
}));

function renderShell(props: { pending?: boolean } = {}) {
  return renderWithProviders(<Shell {...props} />);
}

beforeEach(() => {
  vi.mocked(getUserContext).mockResolvedValue({ schemaVersion: 1, subject: "dev", roles: [] });
});

describe("Shell", () => {
  it("says the content is on its way while a navigation is pending", () => {
    renderShell({ pending: true });

    expect(screen.getByRole("progressbar", { name: t("app.contentLoading") })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
  });

  it("shows no progress once the page has arrived", () => {
    renderShell();

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByRole("main")).not.toHaveAttribute("aria-busy");
  });

  it("renders the skip link, the navigation, the top bar and the main region", () => {
    renderShell();
    expect(screen.getByText(tRe("app.skipToContent"))).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: t("nav.label") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("theme.toggleDark") })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("makes the skip target focusable, so the skip link actually skips", () => {
    // Following a fragment link scrolls to the target but only moves focus there
    // if the target is focusable. Without tabindex the link is decorative: focus
    // stays put and the next Tab re-enters the navigation.
    renderShell();

    const skip = screen.getByText(tRe("app.skipToContent"));
    expect(skip).toHaveAttribute("href", "#main-content");
    expect(document.getElementById("main-content")).toHaveAttribute("tabindex", "-1");
  });

  it("reveals the skip link while it has focus, and hides it again after", () => {
    renderShell();
    const skip = screen.getByText(tRe("app.skipToContent"));

    skip.focus();
    expect(skip.style.position).toBe("static");
    skip.blur();
    expect(skip.style.position).toBe("absolute");
  });
});
