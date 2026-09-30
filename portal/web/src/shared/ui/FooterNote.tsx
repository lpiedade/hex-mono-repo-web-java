import { Typography } from "@mui/material";
import type { ElementType, ReactNode } from "react";

interface FooterNoteProps {
  children: ReactNode;
  /**
   * Semantic element to render as; defaults to a paragraph, which is what a
   * note written as a sentence is.
   *
   * Pass `"div"` when the children are not phrasing content — a pager, a row
   * of buttons, anything laid out as blocks. A `<div>` or a `<button>` inside
   * a `<p>` is invalid HTML: the browser's parser closes the paragraph early
   * and reparents what follows, so the DOM stops matching the tree React
   * rendered. This is what the `footerNote` slots on {@link DataTable} and
   * `SectionCard` do, because a slot typed `ReactNode` cannot promise its
   * content is a sentence.
   */
  component?: ElementType;
}

/**
 * A muted, small-print note rendered under a card or table — used for counts
 * ("showing 25 of 340"), timestamps, and footnotes. Children are rendered as
 * escaped plain text; never pass active markup.
 */
export function FooterNote({ children, component = "p" }: FooterNoteProps) {
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      component={component}
      sx={{ display: "block", m: 0 }}
    >
      {children}
    </Typography>
  );
}
