import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import { IconButton } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useColorMode } from "@/shared/theme";

/**
 * Switches between the light and the dark theme. Its name is the theme it
 * switches *to*, because that is what pressing it does.
 */
export function ToggleColorModeButton() {
  const { t } = useTranslation();
  const { colorMode, toggleColorMode } = useColorMode();

  return (
    <IconButton
      color="inherit"
      onClick={toggleColorMode}
      aria-label={colorMode === "light" ? t("theme.toggleDark") : t("theme.toggleLight")}
    >
      {colorMode === "dark" ? <Brightness7Icon /> : <Brightness4Icon />}
    </IconButton>
  );
}
