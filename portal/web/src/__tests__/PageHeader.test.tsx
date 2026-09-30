import { screen } from "@testing-library/react";
import { Button } from "@mui/material";
import { describe, it, expect } from "vitest";
import "../i18n";
import { PageHeader, PAGE_STATES } from "../components/PageHeader";
import { renderWithProviders } from "./test-utils";

describe("PageHeader", () => {
  it("renders the title as the single primary heading (h1)", () => {
    renderWithProviders(<PageHeader title="Quarterly orders" />);
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe("Quarterly orders");
  });

  it("renders the subtitle and actions slots", () => {
    renderWithProviders(
      <PageHeader
        title="Quarterly orders"
        subtitle="Every order this quarter"
        actions={<Button>New</Button>}
      />,
    );
    expect(screen.getByText("Every order this quarter")).toBeTruthy();
    expect(screen.getByRole("button", { name: "New" })).toBeTruthy();
  });

  it("shows no state notice in the default ready state", () => {
    renderWithProviders(<PageHeader title="Quarterly orders" />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("exposes all seven non-ready page states as a shared pattern", () => {
    expect([...PAGE_STATES].sort()).toEqual(
      [
        "empty",
        "error",
        "forbidden",
        "loading",
        "partial",
        "stale",
        "unavailable",
      ].sort(),
    );
  });

  it("renders loading as a polite status region", () => {
    renderWithProviders(<PageHeader title="Quarterly orders" state="loading" />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("renders error and forbidden states as alert notices", () => {
    const { unmount } = renderWithProviders(
      <PageHeader title="Quarterly orders" state="error" />,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    unmount();
    renderWithProviders(<PageHeader title="Quarterly orders" state="forbidden" />);
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("renders the empty state as an informational status notice", () => {
    renderWithProviders(<PageHeader title="Quarterly orders" state="empty" />);
    // info severity -> polite status region (not an assertive alert).
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("lets a page override the default state message", () => {
    renderWithProviders(
      <PageHeader
        title="Quarterly orders"
        state="error"
        stateMessage="Custom failure message"
      />,
    );
    expect(screen.getByText("Custom failure message")).toBeTruthy();
  });
});
