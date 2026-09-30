import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Banner, type BannerSeverity } from "./Banner";
import { visuallyHidden } from "@/shared/lib";
import type { PageState } from "@/shared/lib";

/** How each banner-surfaced state maps onto a severity (loading is separate). */
const STATE_SEVERITY: Record<Exclude<PageState, "ready" | "loading">, BannerSeverity> = {
  empty: "info",
  partial: "warning",
  stale: "warning",
  unavailable: "error",
  forbidden: "error",
  error: "error",
};

interface PageHeaderProps {
  /** The page's single primary heading (rendered as the only `h1`). */
  title: string;
  subtitle?: string;
  /** Trailing action controls (buttons, menus). */
  actions?: ReactNode;
  /** Current page state; defaults to `ready` (no notice). */
  state?: PageState;
  /** Override the default localized message for the current state. */
  stateMessage?: string;
  /** Id applied to the heading so a landmark can be `aria-labelledby` it. */
  headingId?: string;
}

/**
 * The standard page header: one primary heading, an optional subtitle, an
 * actions slot, and — through {@link PageStateNotice} — the shared page-state
 * pattern. The title is the page's single `h1`; sections below it use
 * `SectionCard` (`h2`).
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  state = "ready",
  stateMessage,
  headingId,
}: PageHeaderProps) {
  return (
    <Box component="header" sx={{ mb: 3 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        gap={2}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography id={headingId} variant="h4" component="h1" sx={{ wordBreak: "break-word" }}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {actions ? <Box sx={{ flexShrink: 0 }}>{actions}</Box> : null}
      </Stack>
      <PageStateNotice state={state} message={stateMessage} />
    </Box>
  );
}

/**
 * Renders the shared notice for a non-`ready` {@link PageState}. `loading` is a
 * polite live region with a spinner; the rest are severity {@link Banner}s. The
 * message defaults to the localized `pageState.<state>` key and can be
 * overridden per page.
 */
export function PageStateNotice({ state, message }: { state: PageState; message?: string }) {
  const { t } = useTranslation();
  if (state === "ready") return null;

  const text = message ?? t(`pageState.${state}`);

  if (state === "loading") {
    return (
      <Box
        role="status"
        aria-live="polite"
        sx={{ display: "flex", alignItems: "center", gap: 1, mt: 2 }}
      >
        <CircularProgress size={18} aria-hidden />
        <Typography color="text.secondary">{text}</Typography>
        <Box component="span" sx={visuallyHidden}>
          {t("pageState.loading")}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Banner severity={STATE_SEVERITY[state]}>{text}</Banner>
    </Box>
  );
}
