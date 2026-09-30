import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../i18n";
import { createItem, deleteItem, listItems, updateItem, type Item } from "../api/client";
import { ApiError } from "../api/errors";
import { ItemsPage } from "../pages/items/ItemsPage";
import { renderWithProviders, t, tRe } from "./test-utils";

vi.mock("../api/client", () => ({
  listItems: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
}));

function item(id: string, name: string, extra: Partial<Item> = {}): Item {
  return {
    schemaVersion: 1,
    id,
    name,
    createdAt: "2026-01-01T10:00:00Z",
    updatedAt: "2026-01-02T10:00:00Z",
    ...extra,
  };
}

const WIDGET = item("00000000-0000-0000-0000-000000000001", "Widget", {
  description: "A small thing",
});
const ANVIL = item("00000000-0000-0000-0000-000000000002", "Anvil", {
  updatedAt: "2026-03-01T10:00:00Z",
});

function listOf(...items: Item[]) {
  return { schemaVersion: 1 as const, items };
}

async function renderLoaded() {
  renderWithProviders(<ItemsPage />);
  return screen.findByRole("table", { name: t("items.caption") });
}

function rowNames(table: HTMLElement): string[] {
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0].textContent ?? "");
}

beforeEach(() => {
  vi.mocked(listItems).mockReset().mockResolvedValue(listOf(WIDGET, ANVIL));
  vi.mocked(createItem).mockReset();
  vi.mocked(updateItem).mockReset();
  vi.mocked(deleteItem).mockReset();
});

describe("ItemsPage — the list", () => {
  it("has one h1 and names the table by its caption", async () => {
    await renderLoaded();
    expect(screen.getByRole("heading", { level: 1, name: t("items.title") })).toBeInTheDocument();
  });

  it("sorts by name, ascending, from the first render", async () => {
    const table = await renderLoaded();
    expect(rowNames(table)).toEqual(["Anvil", "Widget"]);
  });

  it("reverses when the name header is activated again, and sorts by date on request", async () => {
    const user = userEvent.setup();
    const table = await renderLoaded();

    await user.click(within(table).getByRole("button", { name: tRe("items.fields.name") }));
    expect(rowNames(table)).toEqual(["Widget", "Anvil"]);

    await user.click(within(table).getByRole("button", { name: tRe("items.fields.updatedAt") }));
    expect(rowNames(table)).toEqual(["Widget", "Anvil"]);
  });

  it("renders the description, a placeholder where there is none, and a machine-readable date", async () => {
    const table = await renderLoaded();

    expect(within(table).getByText("A small thing")).toBeInTheDocument();
    expect(within(table).getByText("—")).toBeInTheDocument();
    expect(table.querySelector(`time[datetime="${ANVIL.updatedAt}"]`)).not.toBeNull();
  });

  it("counts the items", async () => {
    await renderLoaded();
    expect(screen.getByText(t("items.count", { count: 2 }))).toBeInTheDocument();
  });

  it("says so when there are none", async () => {
    vi.mocked(listItems).mockResolvedValue(listOf());
    await renderLoaded();
    expect(screen.getByText(t("items.empty"))).toBeInTheDocument();
  });

  it("announces loading", () => {
    vi.mocked(listItems).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<ItemsPage />);
    expect(
      screen.getAllByRole("status").some((el) => el.textContent?.includes(t("pageState.loading"))),
    ).toBe(true);
  });

  it("renders a failed read as the page's own unavailable state, with the service message", async () => {
    vi.mocked(listItems).mockRejectedValue(
      new ApiError(503, { code: "UPSTREAM_UNAVAILABLE", correlationId: "corr-9" }),
    );
    renderWithProviders(<ItemsPage />);

    expect(await screen.findByText(t("pageState.unavailable"))).toBeInTheDocument();
    expect(screen.getByText(t("error.upstreamUnavailable"))).toBeInTheDocument();
    expect(screen.getByText(/corr-9/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("ItemsPage — create", () => {
  it("refuses an empty name without calling the API, and focuses the field", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: t("items.create") }));
    const dialog = await screen.findByRole("dialog", { name: t("items.form.createTitle") });
    await user.click(within(dialog).getByRole("button", { name: t("common.create") }));

    const name = within(dialog).getByRole("textbox", { name: tRe("items.fields.name") });
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(within(dialog).getByText(t("items.form.errors.nameRequired"))).toBeInTheDocument();
    expect(name).toHaveFocus();
    expect(createItem).not.toHaveBeenCalled();
  });

  it("refuses a description over the limit and focuses it", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: t("items.create") }));
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByRole("textbox", { name: tRe("items.fields.name") }),
      "Crate",
    );
    const description = within(dialog).getByRole("textbox", {
      name: tRe("items.fields.description"),
    });
    await user.click(description);
    await user.paste("d".repeat(1001));
    await user.click(within(dialog).getByRole("button", { name: t("common.create") }));

    expect(
      within(dialog).getByText(t("items.form.errors.descriptionTooLong", { max: 1000 })),
    ).toBeInTheDocument();
    expect(description).toHaveFocus();
    expect(createItem).not.toHaveBeenCalled();
  });

  it("creates the item, re-reads the list and closes", async () => {
    const user = userEvent.setup();
    vi.mocked(createItem).mockResolvedValue(item("00000000-0000-0000-0000-000000000003", "Crate"));
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: t("items.create") }));
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByRole("textbox", { name: tRe("items.fields.name") }),
      "  Crate  ",
    );
    await user.click(within(dialog).getByRole("button", { name: t("common.create") }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(createItem).toHaveBeenCalledWith({ name: "Crate" });
    expect(listItems).toHaveBeenCalledTimes(2);
  });

  it("keeps the dialog open and shows the refusal inline", async () => {
    const user = userEvent.setup();
    vi.mocked(createItem).mockRejectedValue(
      new ApiError(409, {
        detail: "An item with this name already exists.",
        code: "ITEM_NAME_EXISTS",
        correlationId: "corr-409",
      }),
    );
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: t("items.create") }));
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByRole("textbox", { name: tRe("items.fields.name") }),
      "Anvil",
    );
    await user.click(within(dialog).getByRole("button", { name: t("common.create") }));

    expect(
      await within(dialog).findByText("An item with this name already exists."),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/corr-409/)).toBeInTheDocument();
  });

  it("puts a server field error beside its field", async () => {
    const user = userEvent.setup();
    vi.mocked(createItem).mockRejectedValue(
      new ApiError(400, {
        detail: "Validation failed",
        code: "VALIDATION_FAILED",
        errors: [{ field: "name", code: "Pattern", message: "must not contain slashes" }],
      }),
    );
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: t("items.create") }));
    const dialog = await screen.findByRole("dialog");
    const name = within(dialog).getByRole("textbox", { name: tRe("items.fields.name") });
    await user.type(name, "a/b");
    await user.click(within(dialog).getByRole("button", { name: t("common.create") }));

    expect(await within(dialog).findByText("must not contain slashes")).toBeInTheDocument();
    expect(name).toHaveAttribute("aria-invalid", "true");
  });

  it("closes on cancel without calling the API", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: t("items.create") }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: t("common.cancel") }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(createItem).not.toHaveBeenCalled();
  });
});

describe("ItemsPage — edit", () => {
  it("opens pre-filled and sends the edited fields", async () => {
    const user = userEvent.setup();
    vi.mocked(updateItem).mockResolvedValue({ ...WIDGET, name: "Sprocket" });
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: t("items.edit", { name: "Widget" }) }));
    const dialog = await screen.findByRole("dialog", { name: t("items.form.editTitle") });
    const name = within(dialog).getByRole("textbox", { name: tRe("items.fields.name") });
    expect(name).toHaveValue("Widget");
    expect(
      within(dialog).getByRole("textbox", { name: tRe("items.fields.description") }),
    ).toHaveValue("A small thing");

    await user.clear(name);
    await user.type(name, "Sprocket");
    await user.click(within(dialog).getByRole("button", { name: t("common.save") }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(updateItem).toHaveBeenCalledWith(WIDGET.id, {
      name: "Sprocket",
      description: "A small thing",
    });
    expect(listItems).toHaveBeenCalledTimes(2);
  });
});

describe("ItemsPage — delete", () => {
  it("asks first, naming the item, and deletes on confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteItem).mockResolvedValue(undefined);
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: t("items.delete", { name: "Anvil" }) }));
    const dialog = await screen.findByRole("dialog", { name: t("items.deleteDialog.title") });
    expect(dialog).toHaveAccessibleDescription(t("items.deleteDialog.message", { name: "Anvil" }));
    // Cancel is where focus lands, so a reflexive Enter deletes nothing.
    expect(within(dialog).getByRole("button", { name: t("common.cancel") })).toHaveFocus();

    await user.click(within(dialog).getByRole("button", { name: t("common.delete") }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(deleteItem).toHaveBeenCalledWith(ANVIL.id);
    expect(listItems).toHaveBeenCalledTimes(2);
  });

  it("deletes nothing when cancelled", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: t("items.delete", { name: "Anvil" }) }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: t("common.cancel") }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(deleteItem).not.toHaveBeenCalled();
  });

  it("shows a refused delete inside the dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteItem).mockRejectedValue(
      new ApiError(403, { detail: "You may not delete items.", code: "FORBIDDEN" }),
    );
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: t("items.delete", { name: "Anvil" }) }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: t("common.delete") }));

    expect(await within(dialog).findByText("You may not delete items.")).toBeInTheDocument();
  });
});
