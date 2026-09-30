import { createTheme, type Theme, type Shadows } from "@mui/material/styles";
import {
  fonts,
  radii,
  elevation,
  lightColors,
  darkColors,
  type AppTokens,
  type ColorTokens,
} from "./tokens";

/**
 * Expose the raw tokens on the MUI theme as `theme.app` so components can read
 * radii, elevation and the mono font stack in a typed way, alongside the
 * standard palette/typography.
 */
declare module "@mui/material/styles" {
  interface Theme {
    app: AppTokens;
  }
  interface ThemeOptions {
    app?: AppTokens;
  }
}

const appTokens: AppTokens = { fonts, radii, elevation };

/** MUI `shadows` (25 slots) woven from the two elevation tiers. */
function buildShadows(): Shadows {
  const shadows = new Array<string>(25).fill(elevation.subtle);
  shadows[0] = "none";
  for (let i = 8; i < 25; i += 1) {
    shadows[i] = elevation.lifted;
  }
  return shadows as unknown as Shadows;
}

/**
 * Build the light or dark theme from the tokens (ADR-013). Palette, typography,
 * shape, elevation, and MUI component defaults all derive from `tokens.ts`; the
 * WCAG 2.2 AA guarantees are verified by `__tests__/buildTheme.test.ts`.
 */
export function buildTheme(mode: "light" | "dark"): Theme {
  const c: ColorTokens = mode === "light" ? lightColors : darkColors;

  return createTheme({
    app: appTokens,
    palette: {
      mode,
      primary: {
        main: c.brand.primary,
        dark: c.brand.strong,
        contrastText: c.brand.onBrand,
      },
      secondary: {
        main: c.brand.deep,
        contrastText: c.brand.onBrand,
      },
      error: { main: c.semantic.error, contrastText: c.semantic.onError },
      warning: { main: c.semantic.warning, contrastText: c.semantic.onWarning },
      info: { main: c.semantic.info, contrastText: c.semantic.onInfo },
      success: { main: c.semantic.success, contrastText: c.semantic.onSuccess },
      text: {
        primary: c.text.primary,
        secondary: c.text.secondary,
        disabled: c.text.disabled,
      },
      background: { default: c.surface.app, paper: c.surface.card },
      divider: c.border.default,
    },
    shape: { borderRadius: radii.control },
    shadows: buildShadows(),
    typography: {
      fontFamily: fonts.body,
      h1: { fontFamily: fonts.display, fontWeight: 800 },
      h2: { fontFamily: fonts.display, fontWeight: 700 },
      h3: { fontFamily: fonts.display, fontWeight: 700 },
      h4: { fontFamily: fonts.display, fontWeight: 600 },
      h5: { fontFamily: fonts.display, fontWeight: 600 },
      h6: { fontFamily: fonts.display, fontWeight: 600 },
      subtitle1: { fontFamily: fonts.display, fontWeight: 500 },
      overline: {
        fontWeight: 600,
        letterSpacing: "0.5px",
        textTransform: "uppercase",
      },
      button: { fontWeight: 600, textTransform: "none" },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          // A visible, AA focus indicator on every keyboard-focused control
          // (WCAG 1.4.11 non-text contrast / 2.4.11 focus visible). The offset
          // keeps the ring legible even on a filled (e.g. primary) button.
          ":focus-visible": {
            outline: `2px solid ${c.focus}`,
            outlineOffset: "2px",
          },
          // Honor the OS "reduce motion" preference globally (WCAG 2.3.3).
          "@media (prefers-reduced-motion: reduce)": {
            "*, *::before, *::after": {
              animationDuration: "0.01ms !important",
              animationIterationCount: "1 !important",
              transitionDuration: "0.01ms !important",
              scrollBehavior: "auto !important",
            },
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: radii.control },
          containedPrimary: {
            background: `linear-gradient(180deg, ${c.brand.primary}, ${c.brand.strong})`,
            "&:hover": {
              background: `linear-gradient(180deg, ${c.brand.strong}, ${c.brand.deep})`,
            },
            // The gradient is a plain `background`, so it outranks MUI's own
            // disabled styling and a disabled primary button would look live.
            "&.Mui-disabled": {
              background: c.border.default,
              boxShadow: "none",
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: radii.badge, fontWeight: 600 },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none" },
          rounded: { borderRadius: radii.card },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: { borderRadius: radii.card },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottomColor: c.border.default },
          head: {
            fontWeight: 700,
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            color: c.text.secondary,
            backgroundColor: c.surface.subtle,
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          hover: {
            "&:hover": { backgroundColor: c.surface.subtle },
          },
        },
      },
      MuiLink: {
        defaultProps: { underline: "hover" },
        styleOverrides: { root: { fontWeight: 600 } },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            maxWidth: 340,
            padding: "8px 10px",
            borderRadius: radii.control,
            fontSize: "0.75rem",
            lineHeight: 1.45,
            fontWeight: 400,
          },
        },
      },
    },
  });
}
