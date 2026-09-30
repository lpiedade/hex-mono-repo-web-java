import MenuIcon from "@mui/icons-material/Menu";
import { AppBar, Box, IconButton, Toolbar } from "@mui/material";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/features/change-language";
import { ToggleColorModeButton } from "@/features/toggle-color-mode";
import { APP_BAR_HEIGHT, NAV_WIDTH } from "../config/geometry";

interface TopBarProps {
  /** Opens the narrow-viewport navigation drawer. */
  onOpenNav?: () => void;
  /**
   * Width of the permanent rail beside the bar, which is the rail's to decide:
   * it collapses to icons, and a bar offset by a constant would leave a gap
   * beside it. Below `sm` there is no permanent rail and the offset is unused.
   */
  navWidth?: number;
}

/** The bar across the top of the content: the drawer opener, the language and the theme. */
export function TopBar({ onOpenNav, navWidth = NAV_WIDTH }: TopBarProps) {
  const { t } = useTranslation();

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        width: { sm: `calc(100% - ${navWidth}px)` },
        ml: { sm: `${navWidth}px` },
        // Follows the rail's own transition so the two edges move together.
        transition: "width 160ms ease, margin-left 160ms ease",
        bgcolor: "background.paper",
        color: "text.primary",
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Toolbar sx={{ minHeight: `${APP_BAR_HEIGHT}px`, gap: { xs: 1, sm: 2 } }}>
        {/* Below `sm` the rail is a temporary drawer, so it needs an opener. */}
        <IconButton
          color="inherit"
          edge="start"
          onClick={onOpenNav}
          aria-label={t("nav.open")}
          sx={{ display: { sm: "none" }, mr: -0.5 }}
        >
          <MenuIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1, minWidth: 0 }} />
        <LanguageSelector />
        <ToggleColorModeButton />
      </Toolbar>
    </AppBar>
  );
}
