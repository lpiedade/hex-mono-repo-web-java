/**
 * Public API of `shared/theme` — the design tokens, the MUI theme built from
 * them for either mode, the WCAG contrast helpers that gate them (ADR-013), and
 * the color-mode context. The state behind that context — which mode is active,
 * and the provider that applies it — is the app's (`app/providers`).
 *
 * The self-hosted font faces are not here: registering them is a global side
 * effect of the app's bootstrap (`app/styles/fonts.ts`).
 */
export { buildTheme } from "./buildTheme";
export { ColorModeContext, useColorMode, type ColorMode, type ColorModeState } from "./colorMode";
export { contrastRatio, meetsAA, relativeLuminance } from "./contrast";
export {
  darkColors,
  elevation,
  fonts,
  lightColors,
  radii,
  type AppTokens,
  type ColorTokens,
} from "./tokens";
