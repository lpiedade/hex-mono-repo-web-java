import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BuiltAt } from "../ui/BuiltAt";

describe("BuiltAt", () => {
  it("prints a timestamp in the reader's locale, keeping the instant machine-readable", () => {
    const { container } = render(<BuiltAt iso="2026-09-26T09:14:00Z" locale="en-US" />);
    expect(container.querySelector('time[datetime="2026-09-26T09:14:00Z"]')).not.toBeNull();
  });

  it("prints an unparseable timestamp as it arrived", () => {
    render(<BuiltAt iso="yesterday-ish" locale="en-US" />);
    expect(screen.getByText("yesterday-ish")).toBeInTheDocument();
  });

  it("prints a dash for an absent timestamp", () => {
    render(<BuiltAt iso={undefined} locale="en-US" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
