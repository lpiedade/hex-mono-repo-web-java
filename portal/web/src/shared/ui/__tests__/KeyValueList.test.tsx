import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import "@/shared/i18n";
import { renderWithProviders } from "@/shared/testing";
import { KeyValueList } from "../KeyValueList";

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
