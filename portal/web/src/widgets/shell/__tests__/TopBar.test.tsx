import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, t } from "@/shared/testing";
import { TopBar } from "../ui/TopBar";

describe("TopBar", () => {
  it("carries the theme toggle", () => {
    renderWithProviders(<TopBar />);
    expect(screen.getByRole("button", { name: t("theme.toggleDark") })).toBeInTheDocument();
  });

  it("carries the language selector", () => {
    renderWithProviders(<TopBar />);
    expect(screen.getByRole("button", { name: t("language.select") })).toBeInTheDocument();
  });

  it("opens the narrow-viewport navigation", async () => {
    const user = userEvent.setup();
    const onOpenNav = vi.fn();
    renderWithProviders(<TopBar onOpenNav={onOpenNav} />);

    await user.click(screen.getByRole("button", { name: t("nav.open") }));

    expect(onOpenNav).toHaveBeenCalled();
  });
});
