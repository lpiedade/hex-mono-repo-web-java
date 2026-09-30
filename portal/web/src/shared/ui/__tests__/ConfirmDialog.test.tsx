import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/shared/i18n";
import { ConfirmDialog } from "../ConfirmDialog";
import { renderWithProviders, t } from "@/shared/testing";

function renderDialog(props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  renderWithProviders(
    <ConfirmDialog
      open
      title="Archive the ledger?"
      message="The ledger will move to the archive."
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onConfirm, onCancel };
}

describe("ConfirmDialog", () => {
  it("is a dialog named by its title and described by its message", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog", { name: "Archive the ledger?" });
    expect(dialog).toHaveAccessibleDescription("The ledger will move to the archive.");
  });

  it("confirms with the default label, and cancels", async () => {
    const { onConfirm, onCancel } = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: t("common.confirm") }));
    expect(onConfirm).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: t("common.cancel") }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("disables both buttons while the action runs", () => {
    renderDialog({ pending: true, confirmLabel: "Archive" });
    expect(screen.getByRole("button", { name: "Archive" })).toBeDisabled();
    expect(screen.getByRole("button", { name: t("common.cancel") })).toBeDisabled();
  });

  it("renders nothing when closed", () => {
    renderDialog({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
