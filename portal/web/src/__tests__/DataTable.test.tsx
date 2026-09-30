import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import "../i18n";
import {
  DataTable,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type DataTableColumn,
} from "../components/DataTable";
import { renderWithProviders, tRe } from "./test-utils";

interface Person {
  id: string;
  name: string;
  role: string;
}

const people: Person[] = [
  { id: "1", name: "Alice", role: "Owner" },
  { id: "2", name: "Bob", role: "Reviewer" },
];

const columns: DataTableColumn<Person>[] = [
  { id: "name", header: "Given name", sortable: true, renderCell: (r) => r.name },
  { id: "role", header: "Role", renderCell: (r) => r.role },
];

function baseTable(overrides = {}) {
  return (
    <DataTable
      columns={columns}
      rows={people}
      getRowKey={(r) => r.id}
      caption="People"
      {...overrides}
    />
  );
}

describe("DataTable structure", () => {
  it("renders a semantic table named by its caption", () => {
    renderWithProviders(baseTable());
    expect(screen.getByRole("table", { name: "People" })).toBeTruthy();
  });

  it("renders semantic column headers", () => {
    renderWithProviders(baseTable());
    const headers = screen.getAllByRole("columnheader");
    expect(headers.map((h) => h.textContent)).toEqual(
      expect.arrayContaining(["Given name", "Role"]),
    );
  });

  it("renders one row per datum with escaped cell text", () => {
    renderWithProviders(baseTable());
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("Reviewer")).toBeTruthy();
  });

  it("shows the empty message when there are no rows", () => {
    renderWithProviders(
      baseTable({ rows: [], emptyMessage: "Nobody here" }),
    );
    expect(screen.getByText("Nobody here")).toBeTruthy();
  });
});

describe("DataTable sorting", () => {
  it("exposes aria-sort on the active sorted column", () => {
    renderWithProviders(
      baseTable({ sort: { by: "name", direction: "asc" }, onSortChange: vi.fn() }),
    );
    const nameHeader = screen.getByRole("columnheader", { name: /Given name/ });
    expect(nameHeader.getAttribute("aria-sort")).toBe("ascending");
    const roleHeader = screen.getByRole("columnheader", { name: /Role/ });
    expect(roleHeader.getAttribute("aria-sort")).toBeNull();
  });

  it("calls onSortChange with the column id when a sortable header is activated", async () => {
    const onSortChange = vi.fn();
    renderWithProviders(
      baseTable({ sort: { by: "name", direction: "asc" }, onSortChange }),
    );
    await userEvent.click(screen.getByRole("button", { name: /Given name/ }));
    expect(onSortChange).toHaveBeenCalledWith("name");
  });

  it("announces the active sort in a polite live region", () => {
    renderWithProviders(
      baseTable({ sort: { by: "name", direction: "desc" }, onSortChange: vi.fn() }),
    );
    const live = screen.getByRole("status");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.textContent).toMatch(/Given name/);
  });

  it("does not render a sort control for non-sortable columns", () => {
    renderWithProviders(
      baseTable({ sort: { by: "name", direction: "asc" }, onSortChange: vi.fn() }),
    );
    // Only the sortable "Name" header is a button.
    expect(screen.getAllByRole("button", { name: /Given name/ })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Role/ })).toBeNull();
  });
});

describe("DataTable pagination", () => {
  const paginationProps = {
    page: 0,
    rowsPerPage: DEFAULT_PAGE_SIZE,
    rowCount: 200,
    onPageChange: vi.fn(),
    onRowsPerPageChange: vi.fn(),
  };

  it("defaults to 25 rows per page and caps options at 100", () => {
    expect(DEFAULT_PAGE_SIZE).toBe(25);
    expect(MAX_PAGE_SIZE).toBe(100);
    renderWithProviders(baseTable(paginationProps));
    const options = screen.getAllByRole("option");
    const values = options.map((o) => Number((o as HTMLOptionElement).value));
    expect(values).toEqual([25, 50, 100]);
    expect(Math.max(...values)).toBeLessThanOrEqual(MAX_PAGE_SIZE);
  });

  it("drops any offered page size above the 100 ceiling", () => {
    renderWithProviders(
      baseTable({ ...paginationProps, rowsPerPageOptions: [25, 50, 100, 250] }),
    );
    const values = screen
      .getAllByRole("option")
      .map((o) => Number((o as HTMLOptionElement).value));
    expect(values).not.toContain(250);
    expect(Math.max(...values)).toBe(100);
  });

  it("advances the page with a keyboard-operable next control", async () => {
    const onPageChange = vi.fn();
    renderWithProviders(baseTable({ ...paginationProps, onPageChange }));
    await userEvent.click(
      screen.getByRole("button", { name: tRe("table.pagination.nextPage") }),
    );
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("renders no pager when pagination props are absent", () => {
    renderWithProviders(baseTable());
    expect(screen.queryByRole("button", { name: tRe("table.pagination.nextPage") })).toBeNull();
  });
});

describe("DataTable plain rendering", () => {
  it("renders API-supplied cell content as text, never active HTML", () => {
    const hostile: Person[] = [
      { id: "x", name: "<img src=x onerror=alert(1)>", role: "<b>b</b>" },
    ];
    const { container } = renderWithProviders(baseTable({ rows: hostile }));
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
  });
});

describe("DataTable visually hidden", () => {
  it("stays in the accessibility tree when rendered visually hidden, keyed by id", () => {
    renderWithProviders(
      baseTable({ visuallyHidden: true, id: "hidden-table-data" }),
    );
    const table = screen.getByRole("table", { name: "People" });
    expect(table).toBeTruthy();
    // The id is on the table itself so another element can aria-describedby it.
    const byId = document.getElementById("hidden-table-data");
    expect(byId?.tagName).toBe("TABLE");
    // The data is genuinely present as the text equivalent.
    expect(within(table).getByText("Alice")).toBeTruthy();
  });
});
