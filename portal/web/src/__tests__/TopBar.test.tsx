import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import "../i18n";
import { TopBar } from "../layout/TopBar";
import { renderWithProviders, t } from "./test-utils";

describe("TopBar", () => {
  it("names the theme toggle after the theme it switches to", () => {
    const { rerender } = renderWithProviders(
      <TopBar colorMode="light" onToggleColorMode={() => undefined} />,
    );
    expect(screen.getByRole("button", { name: t("theme.toggleDark") })).toBeInTheDocument();

    rerender(<TopBar colorMode="dark" onToggleColorMode={() => undefined} />);
    expect(screen.getByRole("button", { name: t("theme.toggleLight") })).toBeInTheDocument();
  });

  it("toggles the theme", async () => {
    const onToggleColorMode = vi.fn();
    renderWithProviders(<TopBar colorMode="light" onToggleColorMode={onToggleColorMode} />);

    await userEvent.click(screen.getByRole("button", { name: t("theme.toggleDark") }));

    expect(onToggleColorMode).toHaveBeenCalled();
  });

  it("carries the language selector", () => {
    renderWithProviders(<TopBar colorMode="light" onToggleColorMode={() => undefined} />);
    expect(screen.getByRole("button", { name: t("language.select") })).toBeInTheDocument();
  });

  it("opens the narrow-viewport navigation", async () => {
    const onOpenNav = vi.fn();
    renderWithProviders(
      <TopBar colorMode="light" onToggleColorMode={() => undefined} onOpenNav={onOpenNav} />,
    );

    await userEvent.click(screen.getByRole("button", { name: t("nav.open") }));

    expect(onOpenNav).toHaveBeenCalled();
  });
});
