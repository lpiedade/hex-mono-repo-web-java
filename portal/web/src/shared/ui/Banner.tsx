import { Alert, AlertTitle } from "@mui/material";
import type { ReactNode } from "react";

/** Callout severities, mapped 1:1 onto the MUI/AA semantic palette. */
export type BannerSeverity = "info" | "success" | "warning" | "error";

interface BannerProps {
  severity: BannerSeverity;
  /** Optional bold heading above the message. */
  title?: string;
  children?: ReactNode;
  /**
   * Live-region role. Defaults to an assertive `alert` for warning/error and a
   * polite `status` otherwise, so a page-load banner is not announced urgently
   * while a fresh error is.
   */
  role?: "alert" | "status";
  /** Trailing action slot (e.g. a retry button). */
  action?: ReactNode;
}

/**
 * A severity callout built on MUI `Alert`. The severity icon and text carry the
 * meaning so state is never conveyed by color alone (WCAG 1.4.1); children
 * render as escaped plain text.
 */
export function Banner({ severity, title, children, role, action }: BannerProps) {
  const resolvedRole =
    role ?? (severity === "error" || severity === "warning" ? "alert" : "status");
  return (
    <Alert
      severity={severity}
      variant="outlined"
      role={resolvedRole}
      action={action}
      sx={{ borderRadius: (theme) => `${theme.app.radii.card}px` }}
    >
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      {children}
    </Alert>
  );
}
