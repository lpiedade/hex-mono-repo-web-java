import { Box, LinearProgress } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router-dom";
import { visuallyHidden } from "@/shared/lib";
import { APP_BAR_HEIGHT, NAV_WIDTH, NAV_WIDTH_COLLAPSED } from "../config/geometry";
import { useNavCollapsed } from "../model/useNavCollapsed";
import { Nav } from "./Nav";
import { TopBar } from "./TopBar";

interface ShellProps {
  /**
   * A navigation is under way — typically a lazily loaded screen whose code is
   * still arriving. The current page stays on screen meanwhile; the content
   * region says it is busy and shows a progress bar along its top edge.
   */
  pending?: boolean;
}

/**
 * The application shell. Semantic landmarks, a skip link, a uniquely named
 * navigation landmark, and keyboard-operable header controls are the
 * accessibility contract every page inherits (ADR-013). The page itself is the
 * matched route, rendered into the `<Outlet />`; a route that fails to render
 * is replaced there by its error element, so the shell stays usable.
 */
export function Shell({ pending = false }: ShellProps) {
  const { t } = useTranslation();
  const [navOpen, setNavOpen] = useState(false);
  // The rail's width is read by the rail and by the bar beside it, so it is
  // owned here rather than inside either.
  const { collapsed, toggleCollapsed, announced } = useNavCollapsed();

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <a
        href="#main-content"
        style={{
          position: "absolute",
          left: "-9999px",
          top: "auto",
          width: "1px",
          height: "1px",
          overflow: "hidden",
        }}
        onFocus={(e) => {
          e.currentTarget.style.cssText =
            "position:static;width:auto;height:auto;overflow:visible;";
        }}
        onBlur={(e) => {
          e.currentTarget.style.cssText =
            "position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;";
        }}
      >
        {t("app.skipToContent")}
      </a>

      <Nav
        mobileOpen={navOpen}
        onMobileClose={() => setNavOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />

      {/*
        The rail's new width is a layout change with no text of its own, so
        keyboard users — whose focus deliberately stays where it was — are told
        in words instead. Empty until the first toggle, or the state would be
        announced on every load.
      */}
      <Box role="status" aria-live="polite" sx={visuallyHidden}>
        {announced ? t(`nav.${announced}Announcement`) : ""}
      </Box>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <TopBar
          onOpenNav={() => setNavOpen(true)}
          navWidth={collapsed ? NAV_WIDTH_COLLAPSED : NAV_WIDTH}
        />
        {/*
          `tabIndex={-1}` is what makes the skip link do anything. Following a
          fragment link only *scrolls* to the target; the browser moves focus
          there only if the target is focusable, so without this the next Tab
          walks straight back into the navigation the user was trying to skip.

          The outline is suppressed because this is a region, not a control: it
          is never in the tab order, so there is no keyboard state to indicate.
        */}
        <Box
          component="main"
          id="main-content"
          tabIndex={-1}
          aria-busy={pending || undefined}
          sx={{
            position: "relative",
            mt: `${APP_BAR_HEIGHT}px`,
            // `minWidth: 0` lets a flex child shrink below its content width,
            // which is what stops a wide table from widening the document.
            p: { xs: 2, sm: 3 },
            minWidth: 0,
            "&:focus": { outline: "none" },
          }}
        >
          {pending ? (
            <LinearProgress
              aria-label={t("app.contentLoading")}
              sx={{ position: "absolute", top: 0, left: 0, right: 0 }}
            />
          ) : null}
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
