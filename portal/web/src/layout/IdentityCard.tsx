import LogoutIcon from "@mui/icons-material/Logout";
import { Avatar, Box, Button, Chip, IconButton, Tooltip, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getUserContext, logout } from "../api/client";

/** The query key every reader of the caller's identity shares. */
export const USER_CONTEXT_KEY = ["user-context"] as const;

/** Two-letter avatar initials derived from the subject, uppercased. */
export function initialsOf(subject: string | undefined): string {
  if (!subject) return "··";
  const parts = subject.trim().split(/[\s._@-]+/).filter(Boolean);
  const letters =
    parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : subject.slice(0, 2);
  return letters.toUpperCase();
}

/**
 * Who is signed in, pinned to the bottom of the navigation rail: the subject
 * and the roles `GET /bff/v1/user-context` reports, and the way out.
 *
 * It renders progressively — the shell never blocks on it. While the context
 * loads or fails, the card shows an accessible placeholder, and sign-out stays
 * available either way: a user whose session is in a bad state is exactly the
 * one who needs it.
 *
 * Collapsed, the rail has no room for the card, so only the sign-out control
 * survives, with the subject in its tooltip.
 */
export function IdentityCard({ collapsed = false }: { collapsed?: boolean }) {
  const { t } = useTranslation();
  const { data } = useQuery({ queryKey: USER_CONTEXT_KEY, queryFn: getUserContext });

  const subject = data?.subject;
  const roles = data?.roles ?? [];
  const signOut = t("identity.signOut");

  if (collapsed) {
    return (
      <Box sx={{ p: 1, borderTop: 1, borderColor: "divider", display: "flex", justifyContent: "center" }}>
        <Tooltip title={subject ? `${signOut} (${subject})` : signOut} placement="right">
          <IconButton size="small" onClick={() => void logout()} aria-label={signOut}>
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1.75, borderTop: 1, borderColor: "divider" }}>
      <Box
        component="section"
        aria-label={t("identity.label")}
        sx={{
          border: 1,
          borderColor: "divider",
          borderRadius: 2,
          bgcolor: "background.default",
          p: 1.25,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <Avatar
            aria-hidden
            sx={{
              width: 26,
              height: 26,
              fontSize: 10.5,
              fontWeight: 700,
              fontFamily: (theme) => theme.app.fonts.display,
              bgcolor: "text.primary",
              color: "background.paper",
            }}
          >
            {initialsOf(subject)}
          </Avatar>
          <Typography noWrap sx={{ fontSize: 12, fontWeight: 600, minWidth: 0 }}>
            {subject ?? t("identity.loading")}
          </Typography>
        </Box>
        {roles.length > 0 && (
          <Box
            component="ul"
            aria-label={t("identity.roles")}
            sx={{ listStyle: "none", p: 0, m: 0, mt: 1, display: "flex", flexWrap: "wrap", gap: 0.5 }}
          >
            {roles.map((role) => (
              <Box component="li" key={role}>
                <Chip
                  size="small"
                  variant="outlined"
                  label={t(`identity.role.${role}`)}
                  sx={{ fontFamily: (theme) => theme.app.fonts.mono, fontSize: 10 }}
                />
              </Box>
            ))}
          </Box>
        )}
        <Button
          size="small"
          startIcon={<LogoutIcon fontSize="small" />}
          onClick={() => void logout()}
          sx={{ mt: 1 }}
        >
          {signOut}
        </Button>
      </Box>
    </Box>
  );
}
