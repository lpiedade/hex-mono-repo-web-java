import { Box } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { itemKeys, type Item } from "@/entities/item";
import { deleteItem, REPORTED_INLINE } from "@/shared/api";
import { ApiErrorBanner, ConfirmDialog } from "@/shared/ui";

interface DeleteItemDialogProps {
  /** The item to delete; absent while the dialog is closed. */
  item: Item | undefined;
  onClose: () => void;
}

/**
 * Asks before deleting an item, naming it, and deletes on confirmation. A
 * refusal is shown inside the dialog; on success the item queries are
 * invalidated and re-read, and the dialog closes.
 *
 * It stays mounted, and opens when it is handed an item, so the dialog keeps its
 * exit transition. Dismissing it clears the last attempt, so the next opening
 * starts without the previous refusal on screen.
 */
export function DeleteItemDialog({ item, onClose }: DeleteItemDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    meta: REPORTED_INLINE,
    mutationFn: (target: Item) => deleteItem(target.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: itemKeys.all });
      onClose();
    },
  });

  function dismiss() {
    deleteMutation.reset();
    onClose();
  }

  return (
    <ConfirmDialog
      open={item !== undefined}
      title={t("items.deleteDialog.title")}
      message={item ? t("items.deleteDialog.message", { name: item.name }) : ""}
      confirmLabel={t("common.delete")}
      destructive
      pending={deleteMutation.isPending}
      onCancel={dismiss}
      onConfirm={() => {
        if (item) deleteMutation.mutate(item);
      }}
    >
      {deleteMutation.isError ? (
        <Box sx={{ mt: 2 }}>
          <ApiErrorBanner error={deleteMutation.error} />
        </Box>
      ) : null}
    </ConfirmDialog>
  );
}
