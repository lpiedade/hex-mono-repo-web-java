import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useCallback, useEffect, useState } from "react";

/**
 * Where the rail's width preference lives, on the storage the locale already
 * uses (`i18n.ts`). It is this browser's, not this user's: nothing here travels
 * between machines.
 *
 * Storage being unavailable — private mode — is not an error. The reader falls
 * back to the default and the writer swallows the failure, exactly as
 * `persistLocale` does.
 */
export const NAV_COLLAPSED_STORAGE_KEY = "app.nav.collapsed";

/** The chord that toggles the rail, as a platform-appropriate label. */
export function collapseShortcutLabel(): string {
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  return mac ? "⌘ /" : "Ctrl + /";
}

/**
 * The `aria-keyshortcuts` form of the same chord. Both modifiers are advertised
 * because both are handled — the attribute is a promise to assistive technology
 * and is only safe where a handler exists.
 */
export const COLLAPSE_SHORTCUT = "Control+/ Meta+/";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(NAV_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Non-fatal: the choice simply will not survive a reload.
  }
}

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export interface NavCollapsedState {
  /** Effective state: below `sm` the rail is an overlay drawer and never collapses. */
  collapsed: boolean;
  toggleCollapsed: () => void;
  /**
   * What to announce, or null before the user has touched the control.
   * Rendering the live region with content already in it would have some
   * screen readers announce the rail's state on every page load.
   */
  announced: "collapsed" | "expanded" | null;
}

/**
 * The rail's width preference, its keyboard accelerator, and what to announce
 * when either changes.
 *
 * It lives above the rail rather than inside it because the top bar is offset
 * by the rail's width: one owner, or the bar leaves a gap beside a narrow rail.
 */
export function useNavCollapsed(): NavCollapsedState {
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up("sm"), { noSsr: true });
  const [stored, setStored] = useState<boolean>(readCollapsed);
  const [announced, setAnnounced] = useState<"collapsed" | "expanded" | null>(null);

  useEffect(() => {
    write(NAV_COLLAPSED_STORAGE_KEY, String(stored));
  }, [stored]);

  const toggleCollapsed = useCallback(() => {
    setStored((previous) => {
      setAnnounced(previous ? "expanded" : "collapsed");
      return !previous;
    });
  }, []);

  useEffect(() => {
    if (!wide) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || !(event.ctrlKey || event.metaKey) || event.altKey) return;
      // A layout where `/` needs Shift still produces `event.key === "/"`, so
      // Shift is deliberately not excluded here.
      if (isTextEntry(event.target)) return;
      event.preventDefault();
      toggleCollapsed();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [wide, toggleCollapsed]);

  return { collapsed: wide && stored, toggleCollapsed, announced };
}
