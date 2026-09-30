import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { logout } from "@/shared/api";
import { renderWithProviders, t } from "@/shared/testing";
import { LogoutButton } from "../ui/LogoutButton";

vi.mock("@/shared/api/client", () => ({ logout: vi.fn() }));

describe("LogoutButton", () => {
  it("ends the session", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LogoutButton />);

    await user.click(screen.getByRole("button", { name: t("identity.signOut") }));

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("names the subject in the compact control's tooltip", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LogoutButton compact subject="ada.lovelace" />);

    await user.hover(screen.getByRole("button", { name: t("identity.signOut") }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("ada.lovelace");
  });

  it("is still named when no subject is known", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LogoutButton compact />);

    await user.click(screen.getByRole("button", { name: t("identity.signOut") }));

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
