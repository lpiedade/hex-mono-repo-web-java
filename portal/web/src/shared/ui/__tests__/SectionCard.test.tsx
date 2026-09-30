import { screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import "@/shared/i18n";
import { renderWithProviders } from "@/shared/testing";
import { SectionCard } from "../SectionCard";

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

  /*
    The footer slot can host a pager, and a `<div>` or `<button>` inside a `<p>`
    is invalid HTML: the parser closes the paragraph early and reparents what
    follows. Asserted structurally rather than by watching for React's warning.
  */
  it("lets its footer slot hold a pager without nesting it in a paragraph", () => {
    renderWithProviders(
      <SectionCard title="Section" footerNote={<button type="button">Onwards</button>}>
        <span>body</span>
      </SectionCard>,
    );

    expect(screen.getByRole("button", { name: "Onwards" }).closest("p")).toBeNull();
  });
});
