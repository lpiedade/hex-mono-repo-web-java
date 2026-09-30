import { Box, CircularProgress } from "@mui/material";
import { Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router-dom";
import { visuallyHidden } from "../components/a11y";
import { NAV_WIDTH, NAV_WIDTH_COLLAPSED } from "./dimensions";
import { Nav } from "./Nav";
import { useNavCollapsed } from "./navPreferences";
import { APP_BAR_HEIGHT, TopBar } from "./TopBar";

interface ShellProps {
  colorMode: "light" | "dark";
  onToggleColorMode: () => void;
}

/** Fallback while a lazily loaded content region arrives. */
function ContentFallback() {
  const { t } = useTranslation();
  return (
    <Box display="flex" justifyContent="center" mt={6} aria-live="polite">
      <CircularProgress aria-label={t("app.contentLoading")} />
    </Box>
  );
}

/**
 * The application shell. The navigation and the top bar render first; the
 * content region loads behind a Suspense boundary. Semantic landmarks, a skip
 * link, a uniquely named navigation landmark, and keyboard-operable header
 * controls are the accessibility contract every page inherits (ADR-013).
 */
export function Shell({ colorMode, onToggleColorMode }: ShellProps) {
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
          colorMode={colorMode}
          onToggleColorMode={onToggleColorMode}
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
          sx={{
            mt: `${APP_BAR_HEIGHT}px`,
            // `minWidth: 0` lets a flex child shrink below its content width,
            // which is what stops a wide table from widening the document.
            p: { xs: 2, sm: 3 },
            minWidth: 0,
            "&:focus": { outline: "none" },
          }}
        >
          <Suspense fallback={<ContentFallback />}>
            <Outlet />
          </Suspense>
        </Box>
      </Box>
    </Box>
  );
}
