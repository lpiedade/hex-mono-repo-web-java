import { screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { beforeEach, describe, it, expect, vi } from "vitest";
import "@/shared/i18n";
import { getUserContext } from "@/shared/api";
import { Shell } from "../ui/Shell";
import { collapseShortcutLabel, NAV_COLLAPSED_STORAGE_KEY } from "../model/useNavCollapsed";
import { renderWithProviders, setTestViewportWidth, t, tRe } from "@/shared/testing";

vi.mock("@/shared/api/client", () => ({
  getUserContext: vi.fn(),
  logout: vi.fn(),
}));

/** The chord the toggle names, supplied the way the component supplies it. */
const chord = { shortcut: collapseShortcutLabel() };

/**
 * Presses the rail's accelerator the way a user does — through user-event, so
 * the state change it causes is flushed before the promise resolves — and
 * reports whether the rail consumed the key.
 *
 * The observer is added after the rail's own `window` listener, so it runs
 * second and reads the verdict that listener left on the event.
 */
async function pressShortcut(user: UserEvent, options: { meta?: boolean } = {}): Promise<boolean> {
  let consumed = false;
  const observe = (event: KeyboardEvent) => {
    if (event.key === "/") consumed = event.defaultPrevented;
  };
  window.addEventListener("keydown", observe);
  const modifier = options.meta ? "Meta" : "Control";
  await user.keyboard(`{${modifier}>}/{/${modifier}}`);
  window.removeEventListener("keydown", observe);
  return consumed;
}

function shell() {
  return renderWithProviders(<Shell />);
}

/** What the rail is announcing, or "" before the user has touched it. */
function announcement(): string {
  return screen.getByRole("status").textContent ?? "";
}

describe("the rail's collapse", () => {
  let user: UserEvent;

  beforeEach(() => {
    localStorage.clear();
    // The shell never blocks on the identity query; it fails throughout.
    vi.mocked(getUserContext).mockRejectedValue(new Error("offline"));
    user = userEvent.setup();
  });

  it("starts expanded", () => {
    shell();

    expect(screen.getByRole("button", { name: tRe("nav.collapse", chord) })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: t("identity.label") })).toBeInTheDocument();
  });

  it("says nothing until the user has moved it", () => {
    shell();

    // A live region rendered with its content already in place is announced on
    // page load by some screen readers.
    expect(announcement()).toBe("");
  });

  it("collapses on the pointer control and announces the new state", async () => {
    shell();

    await user.click(screen.getByRole("button", { name: tRe("nav.collapse", chord) }));

    expect(screen.getByRole("button", { name: tRe("nav.expand", chord) })).toBeInTheDocument();
    expect(announcement()).toBe(t("nav.collapsedAnnouncement"));
  });

  it("collapses on Ctrl + / and consumes the key", async () => {
    shell();

    expect(await pressShortcut(user)).toBe(true);

    expect(screen.getByRole("button", { name: tRe("nav.expand", chord) })).toBeInTheDocument();
    expect(announcement()).toBe(t("nav.collapsedAnnouncement"));
  });

  it("answers to Cmd + / as well", async () => {
    shell();

    expect(await pressShortcut(user, { meta: true })).toBe(true);

    expect(screen.getByRole("button", { name: tRe("nav.expand", chord) })).toBeInTheDocument();
  });

  it("expands again, announcing that too", async () => {
    shell();

    await pressShortcut(user);
    expect(screen.getByRole("button", { name: tRe("nav.expand", chord) })).toBeInTheDocument();
    await pressShortcut(user);

    expect(screen.getByRole("button", { name: tRe("nav.collapse", chord) })).toBeInTheDocument();
    expect(announcement()).toBe(t("nav.expandedAnnouncement"));
  });

  it("leaves the chord alone while the user is typing", async () => {
    // `/` is a character in a text field, so the rail does not claim it there.
    shell();
    const editor = document.createElement("textarea");
    document.body.appendChild(editor);
    editor.focus();

    expect(await pressShortcut(user)).toBe(false);

    expect(screen.getByRole("button", { name: tRe("nav.collapse", chord) })).toBeInTheDocument();
    expect(announcement()).toBe("");
    editor.remove();
  });

  it("moves no focus, so the user stays where they were", async () => {
    shell();
    const main = screen.getByRole("main");
    main.focus();

    await pressShortcut(user);

    expect(screen.getByRole("button", { name: tRe("nav.expand", chord) })).toBeInTheDocument();
    expect(main).toHaveFocus();
  });

  it("survives a reload", async () => {
    shell();

    await user.click(screen.getByRole("button", { name: tRe("nav.collapse", chord) }));

    expect(localStorage.getItem(NAV_COLLAPSED_STORAGE_KEY)).toBe("true");
  });

  it("comes back collapsed when that is how it was left", () => {
    localStorage.setItem(NAV_COLLAPSED_STORAGE_KEY, "true");
    shell();

    expect(screen.getByRole("button", { name: tRe("nav.expand", chord) })).toBeInTheDocument();
  });

  it("is inert below the breakpoint, where the rail is an overlay", async () => {
    setTestViewportWidth(320);
    shell();

    expect(await pressShortcut(user)).toBe(false);
    expect(announcement()).toBe("");
  });

  it("renders the whole rail when the user context is unavailable", () => {
    shell();

    expect(screen.getByRole("link", { name: t("nav.items") })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: tRe("nav.label") })).toBeInTheDocument();
  });
});
