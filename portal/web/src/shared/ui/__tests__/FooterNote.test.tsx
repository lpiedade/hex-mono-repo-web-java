import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import "@/shared/i18n";
import { renderWithProviders } from "@/shared/testing";
import { FooterNote } from "../FooterNote";

describe("FooterNote", () => {
  it("renders its text", () => {
    renderWithProviders(<FooterNote>Showing 25 of 340</FooterNote>);
    expect(screen.getByText("Showing 25 of 340")).toBeTruthy();
  });

  // A note written as a sentence stays a paragraph; only a slot that cannot
  // promise phrasing content opts out (DataTable's and SectionCard's suites).
  it("is a paragraph by default", () => {
    renderWithProviders(<FooterNote>Showing 25 of 340</FooterNote>);
    expect(screen.getByText("Showing 25 of 340").tagName).toBe("P");
  });

  it("renders as the element it is given", () => {
    renderWithProviders(<FooterNote component="div">Showing 25 of 340</FooterNote>);
    expect(screen.getByText("Showing 25 of 340").tagName).toBe("DIV");
  });
});
