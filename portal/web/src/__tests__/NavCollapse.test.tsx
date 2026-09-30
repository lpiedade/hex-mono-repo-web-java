import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, it, expect, vi } from "vitest";
import "../i18n";
import { Shell } from "../layout/Shell";
import {
  collapseShortcutLabel,
  NAV_COLLAPSED_STORAGE_KEY,
} from "../layout/navPreferences";
import { setTestViewportWidth } from "../test-setup";
import { renderWithProviders, t, tRe } from "./test-utils";

vi.mock("../api/client", () => ({
  getUserContext: vi.fn().mockRejectedValue(new Error("offline")),
  logout: vi.fn(),
}));

/** The chord the toggle names, supplied the way the component supplies it. */
const chord = { shortcut: collapseShortcutLabel() };

/** Presses the rail's accelerator and reports whether the event was consumed. */
function pressShortcut(options: { meta?: boolean; on?: EventTarget } = {}): boolean {
  const event = new KeyboardEvent("keydown", {
    key: "/",
    ctrlKey: !options.meta,
    metaKey: options.meta ?? false,
    bubbles: true,
    cancelable: true,
  });
  (options.on ?? window).dispatchEvent(event);
  return event.defaultPrevented;
}

function shell() {
  return renderWithProviders(<Shell colorMode="light" onToggleColorMode={() => undefined} />);
}

/** What the rail is announcing, or "" before the user has touched it. */
function announcement(): string {
  return screen.getByRole("status").textContent ?? "";
}

describe("the rail's collapse", () => {
  beforeEach(() => {
    localStorage.clear();
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

    await userEvent.click(screen.getByRole("button", { name: tRe("nav.collapse", chord) }));

    expect(screen.getByRole("button", { name: tRe("nav.expand", chord) })).toBeInTheDocument();
    expect(announcement()).toBe(t("nav.collapsedAnnouncement"));
  });

  it("collapses on Ctrl + / and consumes the key", async () => {
    shell();

    expect(pressShortcut()).toBe(true);

    expect(await screen.findByRole("button", { name: tRe("nav.expand", chord) })).toBeInTheDocument();
    expect(announcement()).toBe(t("nav.collapsedAnnouncement"));
  });

  it("answers to Cmd + / as well", async () => {
    shell();

    expect(pressShortcut({ meta: true })).toBe(true);

    expect(await screen.findByRole("button", { name: tRe("nav.expand", chord) })).toBeInTheDocument();
  });

  it("expands again, announcing that too", async () => {
    shell();

    pressShortcut();
    expect(await screen.findByRole("button", { name: tRe("nav.expand", chord) })).toBeInTheDocument();
    pressShortcut();

    expect(await screen.findByRole("button", { name: tRe("nav.collapse", chord) })).toBeInTheDocument();
    expect(announcement()).toBe(t("nav.expandedAnnouncement"));
  });

  it("leaves the chord alone while the user is typing", () => {
    // `/` is a character in a text field, so the rail does not claim it there.
    shell();
    const editor = document.createElement("textarea");
    document.body.appendChild(editor);

    expect(pressShortcut({ on: editor })).toBe(false);

    expect(screen.getByRole("button", { name: tRe("nav.collapse", chord) })).toBeInTheDocument();
    expect(announcement()).toBe("");
    editor.remove();
  });

  it("moves no focus, so the user stays where they were", async () => {
    shell();
    const main = document.getElementById("main-content");
    main?.focus();

    pressShortcut();
    await screen.findByRole("button", { name: tRe("nav.expand", chord) });

    expect(document.activeElement).toBe(main);
  });

  it("survives a reload", async () => {
    shell();

    await userEvent.click(screen.getByRole("button", { name: tRe("nav.collapse", chord) }));

    expect(localStorage.getItem(NAV_COLLAPSED_STORAGE_KEY)).toBe("true");
  });

  it("comes back collapsed when that is how it was left", () => {
    localStorage.setItem(NAV_COLLAPSED_STORAGE_KEY, "true");
    shell();

    expect(screen.getByRole("button", { name: tRe("nav.expand", chord) })).toBeInTheDocument();
  });

  it("is inert below the breakpoint, where the rail is an overlay", () => {
    setTestViewportWidth(320);
    shell();

    expect(pressShortcut()).toBe(false);
    expect(announcement()).toBe("");
  });

  it("renders the whole rail when the user context is unavailable", () => {
    // The shell never blocks on the identity query; it fails in this suite.
    shell();

    expect(screen.getByRole("link", { name: t("nav.items") })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: tRe("nav.label") })).toBeInTheDocument();
  });
});
