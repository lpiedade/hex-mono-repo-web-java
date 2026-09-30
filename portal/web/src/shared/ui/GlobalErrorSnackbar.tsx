import { Alert, AlertTitle, Box, IconButton, Snackbar, Tooltip } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { subscribeToErrors, TRANSPORT_FAILURE, type ReportedError } from "@/shared/api";
import { UPSTREAM_UNAVAILABLE } from "@/shared/api";

/**
 * The visible half of the safety net: a failure that no screen reported
 * reaches the user here rather than nowhere.
 *
 * It carries the same three things `ApiErrorBanner` does — the safe human
 * message, the stable code and the correlation id, copyable as a sanitized
 * summary. What it never carries is a stack or an internal URL: a transport
 * failure arrives as a sentinel and is translated, not passed through.
 *
 * **It deduplicates while open.** A retried action can fail the same way
 * several times, and a snackbar per failure would bury the screen instead of
 * informing it. An identical message re-reported while the current one is still
 * visible is dropped; a different one replaces it, because the newer failure is
 * the one the user is looking at.
 */
export function GlobalErrorSnackbar() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState<ReportedError | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(
    () =>
      subscribeToErrors((error) => {
        setCurrent((shown) => {
          if (shown && shown.detail === error.detail && shown.code === error.code) {
            return shown;
          }
          return error;
        });
      }),
    [],
  );

  if (!current) return null;

  const message =
    current.detail === TRANSPORT_FAILURE
      ? t("error.bffUnavailable")
      : current.status === 503 && current.code === UPSTREAM_UNAVAILABLE
        ? t("error.upstreamUnavailable")
        : current.detail;

  const summary = [
    current.code ? `${t("error.apiCode")}: ${current.code}` : null,
    current.correlationId ? `${t("error.apiCorrelationId")}: ${current.correlationId}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(summary);
    } catch {
      // No clipboard (an insecure origin) or the browser refused it. The
      // summary is on screen to copy by hand, so there is nothing to report.
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Snackbar
      // Keyed on the report, so a different failure restarts the auto-hide
      // timer instead of inheriting the previous one's remaining time.
      key={current.id}
      open
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      autoHideDuration={10_000}
      onClose={(_event, reason) => {
        // A click anywhere must not dismiss a message carrying a correlation id
        // the user may still be copying.
        if (reason === "clickaway") return;
        setCurrent(null);
      }}
    >
      <Alert
        severity="error"
        variant="filled"
        onClose={() => setCurrent(null)}
        sx={{ maxWidth: 560 }}
        action={
          summary ? (
            <Tooltip title={copied ? t("error.apiCopied") : t("error.apiCopySummary")}>
              <IconButton
                size="small"
                color="inherit"
                onClick={() => void handleCopy()}
                aria-label={t("error.apiCopySummary")}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : undefined
        }
      >
        <AlertTitle>{t("error.unreportedTitle")}</AlertTitle>
        {message}
        {summary && (
          <Box component="span" sx={{ display: "block", mt: 0.5, typography: "caption" }}>
            {summary}
          </Box>
        )}
      </Alert>
    </Snackbar>
  );
}
