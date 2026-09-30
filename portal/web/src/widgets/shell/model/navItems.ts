import HomeIcon from "@mui/icons-material/Home";
import InfoIcon from "@mui/icons-material/Info";
import ListAltIcon from "@mui/icons-material/ListAlt";
import type { SvgIconComponent } from "@mui/icons-material";

/**
 * The rail's destinations, in one place so the rail's shape and its content
 * stay separable. Adding a screen is a route in `app/router/router.tsx`, an entry here,
 * and its `nav.<key>` label in every bundle.
 */
export interface NavItemDef {
  /** Stable en-US i18n key under `nav.`. */
  key: string;
  Icon: SvgIconComponent;
  to: string;
  /** When true the link is active only on an exact path match, never a prefix. */
  end?: boolean;
}

export const NAV_ITEMS: readonly NavItemDef[] = [
  { key: "home", Icon: HomeIcon, to: "/", end: true },
  { key: "items", Icon: ListAltIcon, to: "/items" },
  { key: "about", Icon: InfoIcon, to: "/build" },
];
