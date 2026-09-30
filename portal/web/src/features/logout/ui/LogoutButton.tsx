import LogoutIcon from "@mui/icons-material/Logout";
import { Button, IconButton, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";
import { logout } from "@/shared/api";

interface LogoutButtonProps {
  /** Icon only, named by its tooltip — where there is no room for a label. */
  compact?: boolean;
  /** Who is signed in, named in the compact control's tooltip. */
  subject?: string;
}

/**
 * Ends the browser session. `logout` posts to the BFF and reloads whatever the
 * answer, so the BFF decides what comes next (ADR-010).
 */
export function LogoutButton({ compact = false, subject }: LogoutButtonProps) {
  const { t } = useTranslation();
  const signOut = t("identity.signOut");

  if (compact) {
    return (
      <Tooltip title={subject ? `${signOut} (${subject})` : signOut} placement="right">
        <IconButton size="small" onClick={() => void logout()} aria-label={signOut}>
          <LogoutIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <Button size="small" startIcon={<LogoutIcon fontSize="small" />} onClick={() => void logout()}>
      {signOut}
    </Button>
  );
}
