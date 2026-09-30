import { describe, it, expect } from "vitest";
import { contrastRatio, meetsAA, relativeLuminance } from "../contrast";

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
