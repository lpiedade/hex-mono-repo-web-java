import { createContext, useContext } from "react";

export type ColorMode = "light" | "dark";

export interface ColorModeState {
  colorMode: ColorMode;
  toggleColorMode: () => void;
}

/**
 * The active color mode and the way to flip it, provided by
 * `ColorModeProvider`.
 *
 * A context and not a prop because the data router's route tree is built once,
 * outside any component (`router.tsx`): `App` could only hand the mode to the
 * shell as a prop by rebuilding the router on every toggle, which would reset
 * the navigation state.
 */
export const ColorModeContext = createContext<ColorModeState | null>(null);

export function useColorMode(): ColorModeState {
  const state = useContext(ColorModeContext);
  if (!state) {
    throw new Error("useColorMode is used outside ColorModeProvider");
  }
  return state;
}
