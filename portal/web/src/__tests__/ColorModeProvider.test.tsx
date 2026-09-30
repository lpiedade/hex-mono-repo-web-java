import { render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { useColorMode } from "../theme/colorMode";
import { ColorModeProvider } from "../theme/ColorModeProvider";
import { expectConsole } from "../test-setup";

/** Shows the active mode as its name, and flips it when pressed. */
function ModeButton() {
  const { colorMode, toggleColorMode } = useColorMode();
  return <button onClick={toggleColorMode}>{colorMode}</button>;
}

/** A browser whose OS asks for dark: the only query this provider makes. */
function darkPreference(query: string): MediaQueryList {
  return {
    matches: query.includes("prefers-color-scheme: dark"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  };
}

describe("ColorModeProvider", () => {
  // test-setup.ts's light-mode stub, put back after each test replaces it.
  const setupStub = Object.getOwnPropertyDescriptor(window, "matchMedia");

  afterEach(() => {
    if (setupStub) Object.defineProperty(window, "matchMedia", setupStub);
  });

  it("starts from the OS preference and toggles from there", async () => {
    const user = userEvent.setup();
    window.matchMedia = darkPreference;
    render(
      <ColorModeProvider>
        <ModeButton />
      </ColorModeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "dark" }));

    expect(screen.getByRole("button", { name: "light" })).toBeInTheDocument();
  });

  it("starts light where the browser cannot tell", () => {
    // @ts-expect-error -- an engine without matchMedia, which the type rules out.
    window.matchMedia = undefined;
    render(
      <ColorModeProvider>
        <ModeButton />
      </ColorModeProvider>,
    );

    expect(screen.getByRole("button", { name: "light" })).toBeInTheDocument();
  });
});

describe("useColorMode", () => {
  it("refuses to run outside its provider, rather than inventing a mode", () => {
    // React reports the render error it rethrows.
    expectConsole("error");

    expect(() => renderHook(() => useColorMode())).toThrow(/outside ColorModeProvider/);
  });
});
