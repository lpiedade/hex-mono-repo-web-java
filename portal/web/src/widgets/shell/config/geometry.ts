/**
 * Shell geometry shared by the rail and the top bar. It lives here so neither
 * side imports the other.
 */

/** Width of the permanent navigation rail. */
export const NAV_WIDTH = 264;

/**
 * Width of the same rail collapsed to icons: a 24px icon inside a 40px touch
 * target with the same 8px gutters the expanded rail uses, so an item does not
 * move horizontally when the labels go.
 */
export const NAV_WIDTH_COLLAPSED = 72;

/**
 * Height of the top bar's toolbar, excluding its 1px bottom border. The rail's
 * brand header matches it so the two dividers read as one rule.
 */
export const APP_BAR_HEIGHT = 64;
