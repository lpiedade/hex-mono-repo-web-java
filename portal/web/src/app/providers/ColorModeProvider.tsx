import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { buildTheme, ColorModeContext, type ColorMode } from "@/shared/theme";

/** The OS preference decides the first render; the top bar toggles it after. */
function preferredColorMode(): ColorMode {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Owns the color mode and applies it: the MUI theme for the active mode, the
 * baseline styles, and the context `useColorMode` reads.
 */
export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [colorMode, setColorMode] = useState<ColorMode>(preferredColorMode);
  const theme = useMemo(() => buildTheme(colorMode), [colorMode]);

  const toggleColorMode = useCallback(() => {
    setColorMode((previous) => (previous === "light" ? "dark" : "light"));
  }, []);
  const state = useMemo(() => ({ colorMode, toggleColorMode }), [colorMode, toggleColorMode]);

  return (
    <ColorModeContext.Provider value={state}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
