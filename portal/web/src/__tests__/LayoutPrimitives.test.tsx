import { screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import "../i18n";
import { DataTable } from "../components/DataTable";
import { SectionCard } from "../components/SectionCard";
import { KeyValueList } from "../components/KeyValueList";
import { FooterNote } from "../components/FooterNote";
import { renderWithProviders } from "./test-utils";

describe("SectionCard", () => {
  it("renders a landmark region labelled by its heading", () => {
    renderWithProviders(
      <SectionCard title="Latest activity">
        <p>body</p>
      </SectionCard>,
    );
    const region = screen.getByRole("region", { name: "Latest activity" });
    expect(region).toBeTruthy();
    expect(within(region).getByRole("heading", { level: 2, name: "Latest activity" })).toBeTruthy();
  });

  it("renders meta, actions, and footer note slots", () => {
    renderWithProviders(
      <SectionCard
        title="Revisions"
        meta={<span>3 total</span>}
        actions={<button>New</button>}
        footerNote="Updated a minute ago"
      >
        <p>body</p>
      </SectionCard>,
    );
    expect(screen.getByText("3 total")).toBeTruthy();
    expect(screen.getByRole("button", { name: "New" })).toBeTruthy();
    expect(screen.getByText("Updated a minute ago")).toBeTruthy();
  });

  it("renders its title as escaped plain text", () => {
    const { container } = renderWithProviders(
      <SectionCard title="<b>x</b>">
        <p>body</p>
      </SectionCard>,
    );
    expect(screen.getByText("<b>x</b>")).toBeTruthy();
    expect(container.querySelector("h2 b")).toBeNull();
  });
});

describe("KeyValueList", () => {
  it("renders a description list of key/value pairs", () => {
    const { container } = renderWithProviders(
      <KeyValueList
        items={[
          { key: "Owner", value: "alice" },
          { key: "Status", value: "ACTIVE" },
        ]}
      />,
    );
    expect(container.querySelector("dl")).toBeTruthy();
    expect(container.querySelectorAll("dt")).toHaveLength(2);
    expect(container.querySelectorAll("dd")).toHaveLength(2);
    expect(screen.getByText("Owner")).toBeTruthy();
    expect(screen.getByText("alice")).toBeTruthy();
  });

  it("renders values as escaped plain text", () => {
    const { container } = renderWithProviders(
      <KeyValueList items={[{ key: "Remark", value: "<script>x</script>" }]} />,
    );
    expect(screen.getByText("<script>x</script>")).toBeTruthy();
    expect(container.querySelector("dd script")).toBeNull();
  });
});

describe("FooterNote", () => {
  it("renders its text", () => {
    renderWithProviders(<FooterNote>Showing 25 of 340</FooterNote>);
    expect(screen.getByText("Showing 25 of 340")).toBeTruthy();
  });

  // A note written as a sentence stays a paragraph; only a slot that cannot
  // promise phrasing content opts out.
  it("is a paragraph by default", () => {
    renderWithProviders(<FooterNote>Showing 25 of 340</FooterNote>);
    expect(screen.getByText("Showing 25 of 340").tagName).toBe("P");
  });

  /*
    The two `footerNote` slots host pagers, and a `<div>` or `<button>` inside
    a `<p>` is invalid HTML. The browser's parser repairs it by closing the
    paragraph early and reparenting what follows, so the DOM stops matching
    the tree React rendered and assistive technology reads a paragraph that
    ended somewhere else.

    Asserted structurally rather than by watching for React's warning: the
    warning is a development-build courtesy, and a test that greps console
    output goes quiet the day React changes its wording.
  */
  it.each([
    [
      "DataTable",
      <DataTable
        key="t"
        columns={[{ id: "a", header: "A", renderCell: () => "x" }]}
        rows={[{ id: "1" }]}
        getRowKey={(r: { id: string }) => r.id}
        caption="Rows"
        footerNote={<button type="button">Onwards</button>}
      />,
    ],
    [
      "SectionCard",
      <SectionCard key="s" title="Section" footerNote={<button type="button">Onwards</button>}>
        <span>body</span>
      </SectionCard>,
    ],
  ])("lets %s's footer slot hold a pager without nesting it in a paragraph", (_name, element) => {
    renderWithProviders(element);

    const pager = screen.getByRole("button", { name: "Onwards" });
    expect(pager.closest("p")).toBeNull();
  });
});
