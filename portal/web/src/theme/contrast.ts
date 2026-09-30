/**
 * WCAG 2.2 contrast helpers (ADR-013). Small, dependency-free, and shared by the
 * theme, the contrast tests, and any runtime check. Implements the relative
 * luminance and contrast-ratio formulas from WCAG SC 1.4.3 / 1.4.11.
 */

/** Parse `#rgb` or `#rrggbb` into 0–255 channels. Throws on malformed input. */
function parseHex(hex: string): [number, number, number] {
  const clean = hex.trim().replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Invalid hex color: "${hex}"`);
  }
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Linearize a 0–255 sRGB channel per WCAG. */
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of a hex color, in [0, 1]. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** Contrast ratio between two hex colors, in [1, 21]. Order-independent. */
export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA);
  const lb = relativeLuminance(hexB);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Whether a ratio clears WCAG 2.2 AA: 4.5:1 for normal text, 3:1 for large text
 * (≥18.66px bold or ≥24px) and for non-text UI components (SC 1.4.11).
 */
export function meetsAA(ratio: number, opts?: { large?: boolean }): boolean {
  return ratio >= (opts?.large ? 3 : 4.5);
}
