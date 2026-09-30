import { Box, Paper, Stack, Typography } from "@mui/material";
import { useId, type ReactNode } from "react";
import { FooterNote } from "./FooterNote";

interface SectionCardProps {
  /** Section title, rendered as a heading and used as the section's a11y name. */
  title: string;
  /** Supplementary content beside the title (count, badge, timestamp). */
  meta?: ReactNode;
  /** Action controls aligned to the trailing edge of the header. */
  actions?: ReactNode;
  /** Muted note under the body. */
  footerNote?: ReactNode;
  /** Heading level; defaults to `h2` (the page `h1` lives in `PageHeader`). */
  headingLevel?: "h2" | "h3";
  children?: ReactNode;
}

/**
 * A titled, bordered panel that names a region of the page. Renders a
 * `<section>` labelled by its heading, with optional meta and action slots in
 * the header and an optional footer note. The title is escaped plain text.
 */
export function SectionCard({
  title,
  meta,
  actions,
  footerNote,
  headingLevel = "h2",
  children,
}: SectionCardProps) {
  const headingId = useId();
  return (
    <Paper component="section" variant="outlined" aria-labelledby={headingId} sx={{ p: 3 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="baseline"
        gap={2}
        sx={{ mb: 2 }}
      >
        <Box
          sx={{
            minWidth: 0,
            display: "flex",
            alignItems: "baseline",
            gap: 1,
            flexWrap: "wrap",
          }}
        >
          <Typography id={headingId} variant="h6" component={headingLevel}>
            {title}
          </Typography>
          {meta ? (
            <Box component="span" sx={{ color: "text.secondary" }}>
              {meta}
            </Box>
          ) : null}
        </Box>
        {actions ? <Box sx={{ flexShrink: 0 }}>{actions}</Box> : null}
      </Stack>
      {children}
      {/* `component="div"` for the same reason as DataTable's slot: a prop
          typed `ReactNode` cannot promise its content is phrasing content. */}
      {footerNote ? (
        <Box sx={{ mt: 2 }}>
          <FooterNote component="div">{footerNote}</FooterNote>
        </Box>
      ) : null}
    </Paper>
  );
}
