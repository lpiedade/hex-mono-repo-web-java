import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** What will happen, in a sentence. */
  message: string;
  /** Label of the confirming button; defaults to `common.confirm`. */
  confirmLabel?: string;
  /** Paints the confirming button as destructive. */
  destructive?: boolean;
  /** Disables both buttons while the confirmed action runs. */
  pending?: boolean;
  /** Rendered between the message and the buttons — typically an error banner. */
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A modal yes/no question. Cancel is the first button and the one that
 * receives focus, so pressing Enter by reflex does not run a destructive
 * action. The dialog is named and described by its title and message.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  destructive = false,
  pending = false,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const messageId = useId();

  return (
    <Dialog
      open={open}
      onClose={pending ? undefined : onCancel}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id={messageId}>{message}</DialogContentText>
        {children}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={pending} autoFocus>
          {t("common.cancel")}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={pending}
          variant="contained"
          color={destructive ? "error" : "primary"}
        >
          {confirmLabel ?? t("common.confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
