import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, t } from "@/shared/testing";
import { ColorModeContext, type ColorMode } from "@/shared/theme";
import { ToggleColorModeButton } from "../ui/ToggleColorModeButton";

function renderIn(colorMode: ColorMode, toggleColorMode = vi.fn()) {
  renderWithProviders(
    <ColorModeContext.Provider value={{ colorMode, toggleColorMode }}>
      <ToggleColorModeButton />
    </ColorModeContext.Provider>,
  );
  return toggleColorMode;
}

describe("ToggleColorModeButton", () => {
  it("is named after the theme it switches to", () => {
    renderIn("light");
    expect(screen.getByRole("button", { name: t("theme.toggleDark") })).toBeInTheDocument();
  });

  it("offers the light theme from the dark one", () => {
    renderIn("dark");
    expect(screen.getByRole("button", { name: t("theme.toggleLight") })).toBeInTheDocument();
  });

  it("toggles the mode", async () => {
    const user = userEvent.setup();
    const toggle = renderIn("light");

    await user.click(screen.getByRole("button", { name: t("theme.toggleDark") }));

    expect(toggle).toHaveBeenCalledTimes(1);
  });
});
