/**
 * Shared accessibility helpers for the composed primitives.
 *
 * `visuallyHidden` keeps content in the accessibility tree (read by screen
 * readers) while removing it from the visual layout — the standard technique
 * for sort announcements, table captions that would duplicate a section title,
 * and live regions. `display: none` would take the content out of the tree too.
 */
export const visuallyHidden = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;
