/**
 * Design tokens — the portal's concrete visual language (ADR-013).
 *
 * These values are framework-agnostic: `buildTheme.ts` maps them onto the MUI
 * theme, but this module deliberately imports nothing from MUI so the tokens
 * stay reusable from tests, docs, and any non-MUI surface. WCAG 2.2 AA governs
 * the final values: `__tests__/buildTheme.test.ts` is the gate, so a brand swap is an
 * edit here that the contrast tests then either accept or refuse.
 */

/** Font stacks. Self-hosted families are pulled in by `app/styles/fonts.ts`. */
export const fonts = {
  /** Archivo — display, headings, and numerics (weights 500–800). */
  display: '"Archivo", "Segoe UI", Roboto, Arial, sans-serif',
  /** IBM Plex Sans — body and controls (400–600). Base UI font. */
  body: '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  /** IBM Plex Mono — technical identifiers, codes, ids, timestamps. */
  mono: '"IBM Plex Mono", "Cascadia Code", "Fira Code", Consolas, "Liberation Mono", monospace',
} as const;

/** Corner-radius scale (px): badges, controls, cards. */
export const radii = {
  badge: 4,
  control: 8,
  card: 12,
} as const;

/**
 * Two elevation tiers. `subtle` for resting cards/controls, `lifted` for
 * menus/dialogs/overlays.
 */
export const elevation = {
  subtle: "0 1px 2px rgba(92, 13, 18, 0.12)",
  lifted: "0 14px 30px rgba(92, 13, 18, 0.18)",
} as const;

/** Raw color token shape shared by the light and dark ramps. */
export interface ColorTokens {
  /** Brand ramp plus the on-brand foreground. */
  brand: {
    primary: string;
    strong: string;
    deep: string;
    darkest: string;
    onBrand: string;
  };
  /** Ink tiers. `secondary` is the lightest tier allowed for normal-size text. */
  text: {
    primary: string;
    body: string;
    secondary: string;
    muted: string;
    disabled: string;
  };
  /** Surfaces from the app background up through cards and the alert tint. */
  surface: {
    app: string;
    card: string;
    subtle: string;
    subtler: string;
    alert: string;
  };
  /** Divider / border ramp. Dividers are decorative (exempt from WCAG 1.4.11). */
  border: {
    default: string;
    muted: string;
    subtle: string;
  };
  /** Focus-ring color — non-text UI, ≥3:1 vs its surface (WCAG 1.4.11 / 2.4.11). */
  focus: string;
  /** Semantic fills, each paired with an AA-passing foreground. */
  semantic: {
    success: string;
    onSuccess: string;
    warning: string;
    onWarning: string;
    error: string;
    onError: string;
    info: string;
    onInfo: string;
  };
}

/** Light theme. */
export const lightColors: ColorTokens = {
  brand: {
    primary: "#d81f26",
    strong: "#b8181f",
    deep: "#8f1218",
    darkest: "#5c0d12",
    onBrand: "#ffffff",
  },
  text: {
    primary: "#241c1e",
    body: "#3d3438",
    secondary: "#6b6065",
    // muted and disabled are the quietest *content* colors, not the color of an
    // inactive control, so WCAG's inactive-component exemption does not cover
    // them. Both clear 4.5:1 on the lightest surface they are used on.
    muted: "#6f666a",
    disabled: "#756c70",
  },
  surface: {
    app: "#f7f4f4",
    card: "#ffffff",
    subtle: "#fbf9f9",
    subtler: "#fdfbfb",
    alert: "#fdf0f0",
  },
  border: {
    default: "#e6e0e1",
    muted: "#efeaeb",
    subtle: "#f4f0f0",
  },
  focus: "#d81f26",
  semantic: {
    success: "#1e7d34",
    onSuccess: "#ffffff",
    warning: "#8a5000",
    onWarning: "#ffffff",
    error: "#b3261e",
    onError: "#ffffff",
    info: "#1565c0",
    onInfo: "#ffffff",
  },
};

/**
 * Dark theme. The brand color is lifted so it reads as both a fill (with dark
 * ink) and a link on the near-black surfaces; semantic fills are lightened and
 * paired with dark ink. Gated by the same contrast tests.
 */
export const darkColors: ColorTokens = {
  brand: {
    primary: "#ff6b70",
    strong: "#ff8a8e",
    deep: "#e8696e",
    darkest: "#ffb3b5",
    onBrand: "#241c1e",
  },
  text: {
    primary: "#f4eeef",
    body: "#e3dadd",
    secondary: "#c9bfc2",
    muted: "#a89ea1",
    disabled: "#978d92",
  },
  surface: {
    app: "#1a1416",
    card: "#221a1c",
    subtle: "#2b2124",
    subtler: "#2f2528",
    alert: "#3a1f22",
  },
  border: {
    default: "#3a2f32",
    muted: "#322829",
    subtle: "#2b2124",
  },
  focus: "#ff6b70",
  semantic: {
    success: "#5cc27a",
    onSuccess: "#241c1e",
    warning: "#e0a44a",
    onWarning: "#241c1e",
    error: "#ff6f5e",
    onError: "#241c1e",
    info: "#5aa9e6",
    onInfo: "#241c1e",
  },
};

/** Everything the MUI theme exposes to consumers under `theme.app`. */
export interface AppTokens {
  fonts: typeof fonts;
  radii: typeof radii;
  elevation: typeof elevation;
}
