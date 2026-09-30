import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/errors";
import { Banner } from "./Banner";

interface ApiErrorBannerProps {
  /** The thrown error — may be ApiError (structured) or a plain Error (transport). */
  error: unknown;
  severity?: "error" | "warning";
}

/**
 * Renders a failed request as the user should read it:
 *
 * - a transport failure (no response at all) as the generic "portal
 *   unreachable" message, never the browser's own text, which can name an
 *   internal URL;
 * - the BFF's `503 UPSTREAM_UNAVAILABLE` as "the service is unavailable, try
 *   again", because the request was not refused and its detail is not the point;
 * - any other Problem Details body as its `detail`.
 *
 * The stable code and the correlation id are shown beneath, with a copy
 * affordance, so a user can hand them to whoever reads the server logs.
 */
export function ApiErrorBanner({ error, severity = "error" }: ApiErrorBannerProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  if (!(error instanceof ApiError)) {
    return <Banner severity={severity}>{t("error.bffUnavailable")}</Banner>;
  }

  const message = error.upstreamUnavailable ? t("error.upstreamUnavailable") : error.detail;

  const summary = [
    error.code ? `${t("error.apiCode")}: ${error.code}` : null,
    error.correlationId ? `${t("error.apiCorrelationId")}: ${error.correlationId}` : null,
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
    <Banner
      severity={severity}
      action={
        summary ? (
          <Tooltip title={copied ? t("error.apiCopied") : t("error.apiCopySummary")}>
            <IconButton
              size="small"
              onClick={() => void handleCopy()}
              aria-label={t("error.apiCopySummary")}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : undefined
      }
    >
      <Typography variant="body2" component="span">
        {message}
      </Typography>
      {summary && (
        <Box
          component="span"
          sx={{ display: "block", mt: 0.5, typography: "caption", color: "text.secondary" }}
        >
          {summary}
        </Box>
      )}
    </Banner>
  );
}
