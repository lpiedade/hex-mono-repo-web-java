import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "../i18n";
import { DataTable } from "../components/DataTable";
import { buildTheme } from "../theme";
import { darkColors, lightColors } from "../theme/tokens";

interface Row {
  id: string;
}

const ROWS: Row[] = [{ id: "r1" }];

/**
 * Rendered with its own `ThemeProvider` rather than through
 * `renderWithProviders`, which fixes the light theme. The whole claim under
 * test is that one line serves both, so a helper that can only produce one of
 * them cannot check it.
 */
function renderIn(mode: "light" | "dark") {
  const theme = buildTheme(mode);
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <DataTable
        columns={[{ id: "id", header: "Id", renderCell: (r: Row) => r.id }]}
        rows={ROWS}
        getRowKey={(r) => r.id}
        caption="surface probe"
      />
    </ThemeProvider>,
  );
}

/** The scrolling container is the table's parent; that is what carries the surface. */
function container(): HTMLElement {
  return screen.getByRole("table").parentElement as HTMLElement;
}

/** `rgb(255, 255, 255)` → `#ffffff`, so an assertion can name a token's value. */
function toHex(rgb: string): string {
  const parts = rgb.match(/\d+/g);
  if (!parts) return rgb;
  return (
    "#" +
    parts
      .slice(0, 3)
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join("")
  );
}

describe("DataTable surface", () => {
  /**
   * Asserted against the token rather than a literal. A test that hardcoded
   * `#ffffff` would keep passing if someone swapped the component onto a hex
   * of its own, which is the regression worth catching: the defect was never
   * the colour, it was the table having no surface and no single source for
   * one.
   */
  it("sits on the card surface in the light theme", () => {
    renderIn("light");

    expect(toHex(getComputedStyle(container()).backgroundColor)).toBe(lightColors.surface.card);
  });

  it("sits on the card surface in the dark theme, from the same line", () => {
    renderIn("dark");

    expect(toHex(getComputedStyle(container()).backgroundColor)).toBe(darkColors.surface.card);
  });

  it("is delimited, not merely tinted", () => {
    // A background alone would still read as part of the page on a surface
    // whose contrast against `app` is as low as the dark theme's.
    renderIn("light");
    const style = getComputedStyle(container());

    expect(style.borderTopWidth).toBe("1px");
    expect(toHex(style.borderTopColor)).toBe(lightColors.border.default);
    // The shorthand, not a longhand: jsdom reports `border-radius` as emotion
    // emits it and does not expand it into the four corners.
    expect(style.borderRadius).toBe("12px");
  });

  /**
   * A table rendered only for assistive technology is not a card and must not
   * grow one — it is not supposed to be seen at all.
   */
  it("gives no visible surface to a visually hidden table", () => {
    const theme = buildTheme("light");
    render(
      <ThemeProvider theme={theme}>
        <DataTable
          columns={[{ id: "id", header: "Id", renderCell: (r: Row) => r.id }]}
          rows={ROWS}
          getRowKey={(r) => r.id}
          caption="hidden probe"
          visuallyHidden
        />
      </ThemeProvider>,
    );

    // The wrapper clips it out of the layout, so the card never paints.
    const root = screen.getByRole("table").closest("div")?.parentElement;
    expect(getComputedStyle(root as HTMLElement).position).toBe("absolute");
  });
});
