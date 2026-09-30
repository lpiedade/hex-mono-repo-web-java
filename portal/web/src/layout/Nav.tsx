import KeyboardDoubleArrowLeftIcon from "@mui/icons-material/KeyboardDoubleArrowLeft";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import {
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import type { SxProps, Theme } from "@mui/material/styles";
import { useTheme } from "@mui/material/styles";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { APP_BAR_HEIGHT, NAV_WIDTH, NAV_WIDTH_COLLAPSED } from "./dimensions";
import { IdentityCard } from "./IdentityCard";
import { NAV_ITEMS, type NavItemDef } from "./navItems";
import { COLLAPSE_SHORTCUT, collapseShortcutLabel } from "./navPreferences";

export { NAV_WIDTH };

const itemSx: SxProps<Theme> = {
  position: "relative",
  mx: 1,
  my: 0.25,
  borderRadius: 1,
  color: "text.secondary",
  "& .MuiListItemIcon-root": { color: "text.secondary", minWidth: 34 },
  "&:hover": { bgcolor: "action.hover" },
  "&.active": {
    bgcolor: "action.selected",
    color: "text.primary",
    "& .MuiListItemText-primary": { fontWeight: 600 },
    "& .MuiListItemIcon-root": { color: "primary.main" },
    "&::before": {
      content: '""',
      position: "absolute",
      left: 0,
      top: "50%",
      transform: "translateY(-50%)",
      width: 3,
      height: 18,
      borderRadius: "0 3px 3px 0",
      bgcolor: "primary.main",
    },
  },
};

function NavItemLink({ item, collapsed }: { item: NavItemDef; collapsed: boolean }) {
  const { t } = useTranslation();
  const label = t(`nav.${item.key}`);
  const { Icon } = item;

  const link = (
    <ListItemButton
      component={NavLink}
      to={item.to}
      end={item.end}
      aria-label={label}
      sx={{
        ...itemSx,
        justifyContent: collapsed ? "center" : "flex-start",
        px: collapsed ? 1 : 2,
        ...(collapsed && { "& .MuiListItemIcon-root": { minWidth: 0, justifyContent: "center" } }),
      }}
    >
      <ListItemIcon>
        <Icon />
      </ListItemIcon>
      {!collapsed && <ListItemText primary={label} />}
    </ListItemButton>
  );

  // Collapsed, the tooltip is the only name the icon has on screen, so it is
  // not decoration here. Expanded, the label is already rendered.
  return collapsed ? (
    <Tooltip title={label} placement="right">
      <Box>{link}</Box>
    </Tooltip>
  ) : (
    link
  );
}

function BrandHeader({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        px: collapsed ? 1.5 : 2.75,
        // Matches the top bar so the two bottom borders meet as a single rule.
        // `+ 1` because this box is border-box and the toolbar's height
        // excludes the AppBar border that sits outside it.
        height: `${APP_BAR_HEIGHT + 1}px`,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "flex-start",
        gap: 1.5,
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 34,
          height: 34,
          flexShrink: 0,
          borderRadius: 2,
          display: "grid",
          placeItems: "center",
          background: (theme) =>
            `linear-gradient(160deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
          color: "primary.contrastText",
          boxShadow: 2,
          fontFamily: (theme) => theme.app.fonts.display,
          fontWeight: 800,
          fontSize: 15,
        }}
      >
        {t("app.mark")}
      </Box>
      {!collapsed && (
        <Typography
          component="span"
          sx={{
            fontFamily: (theme) => theme.app.fonts.display,
            fontWeight: 800,
            fontSize: 15,
            letterSpacing: "0.02em",
          }}
        >
          {t("app.name")}
        </Typography>
      )}
    </Box>
  );
}

/**
 * The pointer route to the same toggle the shortcut drives. Its name states
 * the chord, which is how an accelerator becomes discoverable, and
 * `aria-keyshortcuts` says the same thing to assistive technology. Expanded,
 * the chord is also printed beside the control (`aria-hidden`, because the
 * button's name already carries it).
 */
function CollapseToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const shortcut = collapseShortcutLabel();
  const label = t(collapsed ? "nav.expand" : "nav.collapse", { shortcut });

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        px: 1,
        py: 0.5,
      }}
    >
      {!collapsed && (
        <Box
          component="span"
          aria-hidden
          sx={{
            ml: 0.5,
            fontFamily: (theme) => theme.app.fonts.mono,
            fontSize: 10,
            border: 1,
            borderColor: "divider",
            borderRadius: 0.5,
            px: 0.5,
            color: "text.disabled",
          }}
        >
          {shortcut}
        </Box>
      )}
      <Tooltip title={label} placement="right">
        <IconButton
          size="small"
          onClick={onToggle}
          aria-label={label}
          aria-expanded={!collapsed}
          aria-keyshortcuts={COLLAPSE_SHORTCUT}
        >
          {collapsed ? (
            <KeyboardDoubleArrowRightIcon fontSize="small" />
          ) : (
            <KeyboardDoubleArrowLeftIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
    </Box>
  );
}

interface NavProps {
  /** Whether the narrow-viewport drawer is showing. Ignored from `sm` up. */
  mobileOpen?: boolean;
  /** Closes the narrow-viewport drawer — on backdrop, Escape, or a destination. */
  onMobileClose?: () => void;
  /** Whether the permanent rail is 72px of icons. Owned by the shell. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

/**
 * The left navigation: every destination in {@link NAV_ITEMS}, inside a rail
 * that collapses to icons, with the signed-in identity at its foot.
 */
export function Nav({
  mobileOpen = false,
  onMobileClose,
  collapsed = false,
  onToggleCollapsed,
}: NavProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up("sm"), { noSsr: true });

  // Widening past the breakpoint swaps in the permanent rail and leaves the
  // caller's open flag set. Without this, narrowing again would re-open a
  // drawer the user never asked for.
  useEffect(() => {
    if (wide && mobileOpen) onMobileClose?.();
  }, [wide, mobileOpen, onMobileClose]);

  // The overlay drawer is never collapsed: icons inside an overlay answer no
  // question, and the width it would save is the backdrop's.
  const iconsOnly = collapsed && wide;
  const width = iconsOnly ? NAV_WIDTH_COLLAPSED : NAV_WIDTH;

  const paperSx = {
    width,
    boxSizing: "border-box",
    borderRight: 1,
    borderColor: "divider",
    display: "flex",
    flexDirection: "column",
    overflowX: "hidden",
    // Stilled under `prefers-reduced-motion` by the global rule in
    // `theme/index.ts`.
    transition: "width 160ms ease",
  } as const;

  const content = (
    <>
      <BrandHeader collapsed={iconsOnly} />
      <List component="nav" aria-label={t("nav.label")} sx={{ flex: 1, overflowY: "auto", py: 1 }}>
        {NAV_ITEMS.map((item) => (
          <NavItemLink key={item.key} item={item} collapsed={iconsOnly} />
        ))}
      </List>
      {wide && onToggleCollapsed && (
        <CollapseToggle collapsed={iconsOnly} onToggle={onToggleCollapsed} />
      )}
      <IdentityCard collapsed={iconsOnly} />
    </>
  );

  /*
   * Below `sm` the rail becomes a temporary drawer. A 264px permanent rail
   * leaves 56px of content at a 320px viewport, which would force
   * two-dimensional scrolling (WCAG 2.2 SC 1.4.10). Every destination stays
   * reachable — the same list, behind the header's menu button.
   *
   * The variant is chosen in JavaScript rather than by rendering both drawers
   * and hiding one with CSS: two mounted drawers would put two navigation
   * landmarks and two copies of every destination in the DOM.
   */
  if (wide) {
    return (
      <Drawer
        variant="permanent"
        sx={{
          width,
          flexShrink: 0,
          "& .MuiDrawer-paper": paperSx,
        }}
      >
        {content}
      </Drawer>
    );
  }

  return (
    <Drawer
      variant="temporary"
      open={mobileOpen}
      onClose={onMobileClose}
      // Closing on any click inside means following a destination dismisses the
      // drawer, which is what a user expects of an overlay navigation.
      onClick={onMobileClose}
      ModalProps={{ keepMounted: true }}
      sx={{ "& .MuiDrawer-paper": paperSx }}
    >
      {content}
    </Drawer>
  );
}
