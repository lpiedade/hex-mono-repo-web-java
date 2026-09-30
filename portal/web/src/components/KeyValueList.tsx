import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";

export interface KeyValueItem {
  key: string;
  value: ReactNode;
}

interface KeyValueListProps {
  items: KeyValueItem[];
}

/**
 * A semantic description list (`<dl>`) of key/value pairs — the standard way to
 * present record metadata. Keys and values are escaped plain text; the `dt`/`dd`
 * pairing gives assistive tech the label→value association.
 */
export function KeyValueList({ items }: KeyValueListProps) {
  return (
    <Box
      component="dl"
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "auto 1fr" },
        rowGap: 1,
        columnGap: 3,
        m: 0,
      }}
    >
      {items.map((item) => (
        // HTML permits a <div> wrapping each dt/dd group inside a <dl>;
        // `display: contents` keeps the grid two-column.
        <Box key={item.key} sx={{ display: "contents" }}>
          <Typography component="dt" variant="body2" color="text.secondary">
            {item.key}
          </Typography>
          <Typography component="dd" variant="body2" sx={{ m: 0 }}>
            {item.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
