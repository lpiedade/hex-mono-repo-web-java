import { describe, it, expect } from "vitest";
import {
  buildTheme,
  contrastRatio,
  meetsAA,
  relativeLuminance,
  fonts,
  lightColors,
  darkColors,
} from "../theme";

const MODES = ["light", "dark"] as const;
// Every filled control whose label sits on the fill and must clear AA.
const FILLED_ROLES = ["primary", "secondary", "success", "warning", "error", "info"] as const;

describe("WCAG contrast helpers", () => {
  it("computes the reference black/white ratio as 21:1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 1);
  });

  it("is order-independent and bounded", () => {
    expect(contrastRatio("#d81f26", "#ffffff")).toBeCloseTo(contrastRatio("#ffffff", "#d81f26"), 5);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("applies the AA thresholds (4.5 normal, 3 large / non-text)", () => {
    expect(meetsAA(4.6)).toBe(true);
    expect(meetsAA(4.4)).toBe(false);
    expect(meetsAA(3.1)).toBe(false);
    expect(meetsAA(3.1, { large: true })).toBe(true);
    expect(meetsAA(2.9, { large: true })).toBe(false);
  });

  it("accepts 3- and 6-digit hex", () => {
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 1);
    expect(() => relativeLuminance("nope")).toThrow();
  });
});

describe.each(MODES)("%s theme — WCAG 2.2 AA", (mode) => {
  const p = buildTheme(mode).palette;

  it("normal-size text clears 4.5:1 on its surface", () => {
    expect(meetsAA(contrastRatio(p.text.primary, p.background.default))).toBe(true);
    // text.secondary is the lightest tier permitted for normal text.
    expect(meetsAA(contrastRatio(p.text.secondary, p.background.paper))).toBe(true);
    expect(meetsAA(contrastRatio(p.text.secondary, p.background.default))).toBe(true);
  });

  it("every text tier clears AA on every surface it can appear on", () => {
    // Checking only primary and secondary would pass while a quieter tier
    // painted real content below AA. WCAG exempts an *inactive component's* text; it does not exempt a token
    // named "disabled" that renders active content, which is what these do.
    const tiers = ["primary", "secondary", "disabled"] as const;
    const surfaces = [p.background.default, p.background.paper];

    for (const tier of tiers) {
      for (const surface of surfaces) {
        const ratio = contrastRatio(p.text[tier], surface);
        expect(
          meetsAA(ratio),
          `text.${tier} on ${surface} is ${ratio.toFixed(2)}:1, below the 4.5:1 AA floor`,
        ).toBe(true);
      }
    }
  });

  it("every filled control pairs its label with an AA foreground", () => {
    // primary + secondary + the four semantics — the label sits on the fill.
    for (const role of FILLED_ROLES) {
      const ratio = contrastRatio(p[role].contrastText, p[role].main);
      expect(meetsAA(ratio), `${mode} ${role}`).toBe(true);
    }
  });

  it("primary reads as normal-size text where MuiLink renders it", () => {
    // MuiLink paints primary.main as body text on cards and the app surface, so
    // it must clear the 4.5 normal-text gate, not just the 3:1 non-text one.
    expect(meetsAA(contrastRatio(p.primary.main, p.background.paper))).toBe(true);
    expect(meetsAA(contrastRatio(p.primary.main, p.background.default))).toBe(true);
  });

  it("the focus ring clears non-text contrast on the app surface (SC 1.4.11)", () => {
    const colors = mode === "light" ? lightColors : darkColors;
    expect(meetsAA(contrastRatio(colors.focus, colors.surface.app), { large: true })).toBe(true);
  });
});

describe("theme typography", () => {
  const theme = buildTheme("light");

  it("uses IBM Plex Sans for body and Archivo for display headings", () => {
    expect(theme.typography.fontFamily).toContain("IBM Plex Sans");
    expect(theme.typography.h1.fontFamily).toContain("Archivo");
    expect(theme.typography.h6.fontFamily).toContain("Archivo");
  });

  it("exposes the IBM Plex Mono stack for technical values", () => {
    expect(theme.app.fonts.mono).toContain("IBM Plex Mono");
    expect(fonts.mono).toContain("IBM Plex Mono");
  });
});

describe("theme shape, elevation & motion", () => {
  const theme = buildTheme("light");

  it("uses the 4 / 8 / 12 radius scale with 8 as the base", () => {
    expect(theme.shape.borderRadius).toBe(8);
    expect(theme.app.radii).toEqual({ badge: 4, control: 8, card: 12 });
  });

  it("weaves the two elevation tiers into the shadow scale", () => {
    expect(theme.shadows[0]).toBe("none");
    expect(theme.shadows[1]).toBe(theme.app.elevation.subtle);
    expect(theme.shadows[24]).toBe(theme.app.elevation.lifted);
  });

  it("honours prefers-reduced-motion via CssBaseline", () => {
    const overrides = JSON.stringify(theme.components?.MuiCssBaseline?.styleOverrides);
    expect(overrides).toContain("prefers-reduced-motion");
  });

  it("wires a global focus-visible outline", () => {
    const overrides = JSON.stringify(theme.components?.MuiCssBaseline?.styleOverrides);
    expect(overrides).toContain("focus-visible");
  });
});

describe("MUI component overrides", () => {
  const components = buildTheme("light").components ?? {};

  it("customises Button, Chip, Paper, Link and Table", () => {
    expect(components.MuiButton).toBeTruthy();
    expect(components.MuiChip).toBeTruthy();
    expect(components.MuiPaper).toBeTruthy();
    expect(components.MuiLink).toBeTruthy();
    expect(components.MuiTableCell ?? components.MuiTableHead).toBeTruthy();
  });
});
