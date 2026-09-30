import { Box, CircularProgress } from "@mui/material";
import { useTranslation } from "react-i18next";

/**
 * What the router renders while the first screen's code is still arriving: a
 * lazily loaded route (`router.tsx`) has nothing to show until its chunk does,
 * and on a cold load there is no previous page to keep on screen meanwhile.
 * A polite live region, so the wait is announced without interrupting.
 */
export function ContentFallback() {
  const { t } = useTranslation();
  return (
    <Box aria-live="polite" sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
      <CircularProgress aria-label={t("app.contentLoading")} />
    </Box>
  );
}
