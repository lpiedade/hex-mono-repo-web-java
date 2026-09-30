import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders, t } from "@/shared/testing";
import { NotFoundPage } from "../ui/NotFoundPage";

describe("NotFoundPage", () => {
  it("names the address that matched nothing and offers the way home", () => {
    renderWithProviders(<NotFoundPage />, { initialPath: "/nowhere" });

    expect(
      screen.getByRole("heading", { level: 1, name: t("notFound.title") }),
    ).toBeInTheDocument();
    expect(screen.getByText(t("notFound.body", { path: "/nowhere" }))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t("notFound.home") })).toHaveAttribute("href", "/");
  });
});
