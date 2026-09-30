import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getUserContext, logout } from "@/shared/api";
import { renderWithProviders, t } from "@/shared/testing";
import { IdentityCard } from "../ui/IdentityCard";

vi.mock("@/shared/api/client", () => ({
  getUserContext: vi.fn(),
  logout: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(getUserContext).mockResolvedValue({
    schemaVersion: 1,
    subject: "ada.lovelace",
    roles: ["READER", "EDITOR"],
  });
});

describe("IdentityCard", () => {
  it("shows the subject, its initials and the roles from the user context", async () => {
    renderWithProviders(<IdentityCard />);

    expect(await screen.findByText("ada.lovelace")).toBeInTheDocument();
    expect(screen.getByText("AL")).toBeInTheDocument();
    const roles = screen.getByRole("list", { name: t("identity.roles") });
    expect(roles).toHaveTextContent(t("identity.role.READER"));
    expect(roles).toHaveTextContent(t("identity.role.EDITOR"));
    expect(roles).not.toHaveTextContent(t("identity.role.ADMIN"));
  });

  it("shows a placeholder while the context loads", () => {
    vi.mocked(getUserContext).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<IdentityCard />);

    expect(screen.getByText(t("identity.loading"))).toBeInTheDocument();
  });

  it("signs out", async () => {
    const user = userEvent.setup();
    renderWithProviders(<IdentityCard />);

    await user.click(screen.getByRole("button", { name: t("identity.signOut") }));

    expect(logout).toHaveBeenCalled();
  });

  it("keeps only the sign-out control when collapsed", async () => {
    const user = userEvent.setup();
    renderWithProviders(<IdentityCard collapsed />);

    expect(screen.queryByRole("region", { name: t("identity.label") })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: t("identity.signOut") }));
    expect(logout).toHaveBeenCalled();
  });
});
