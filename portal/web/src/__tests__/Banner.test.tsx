import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import "../i18n";
import { Banner } from "../components/Banner";
import { renderWithProviders } from "./test-utils";

describe("Banner", () => {
  it("renders an info banner as a polite status region", () => {
    renderWithProviders(<Banner severity="info">Heads up</Banner>);
    const region = screen.getByRole("status");
    expect(region).toBeTruthy();
    expect(screen.getByText("Heads up")).toBeTruthy();
  });

  it("renders an error banner as an assertive alert region", () => {
    renderWithProviders(<Banner severity="error">It broke</Banner>);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("It broke")).toBeTruthy();
  });

  it("renders an optional title", () => {
    renderWithProviders(
      <Banner severity="warning" title="Careful">
        Body text
      </Banner>,
    );
    expect(screen.getByText("Careful")).toBeTruthy();
    expect(screen.getByText("Body text")).toBeTruthy();
  });

  it("renders children as escaped plain text, never active markup", () => {
    const { container } = renderWithProviders(
      <Banner severity="error">{"<b>bold</b><img src=x>"}</Banner>,
    );
    expect(screen.getByText("<b>bold</b><img src=x>")).toBeTruthy();
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("honors an explicit role override", () => {
    renderWithProviders(
      <Banner severity="error" role="status">
        quiet error
      </Banner>,
    );
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
