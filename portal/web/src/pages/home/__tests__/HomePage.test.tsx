import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders, t, tRe } from "@/shared/testing";
import { HomePage } from "../ui/HomePage";

describe("HomePage", () => {
  it("links to the items screen", () => {
    renderWithProviders(<HomePage />);

    expect(screen.getByRole("heading", { level: 1, name: t("home.title") })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: tRe("home.items.cta") })).toHaveAttribute(
      "href",
      "/items",
    );
  });
});
