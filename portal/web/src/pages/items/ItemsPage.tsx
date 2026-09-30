import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { Box, Button, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { deleteItem, listItems, type Item } from "../../api/client";
import { REPORTED_INLINE } from "../../api/errorReporting";
import { ApiErrorBanner } from "../../components/ApiErrorBanner";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { DataTable, type DataTableColumn } from "../../components/DataTable";
import { PageHeader, pageStateOf } from "../../components/PageHeader";
import { useClientSort, type SortAccessors } from "../../components/useClientSort";
import { ItemDialog } from "./ItemDialog";
import { ITEMS_KEY } from "./queryKeys";

const EMPTY: Item[] = [];

/** Stable, so `useClientSort` does not re-sort on every render. */
const SORT_ACCESSORS: SortAccessors<Item> = {
  name: (item) => item.name,
  updatedAt: (item) => new Date(item.updatedAt),
};

/** Which dialog is open: none, the create form, the edit form, or a delete confirmation. */
type Dialog =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; item: Item }
  | { kind: "delete"; item: Item };

/**
 * The template's example resource, end to end: list, create, edit, delete.
 *
 * The list is fetched whole — the contract does not page it — so it is sorted
 * in memory (portal/CLAUDE.md, "who sorts a list"). Every write invalidates the
 * list and lets React Query re-read it; nothing is patched into the cache by
 * hand. Replace `items` with the project's first real aggregate and keep the
 * shape.
 */
export function ItemsPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<Dialog>({ kind: "none" });

  const itemsQuery = useQuery({ queryKey: ITEMS_KEY, queryFn: listItems });
  const { rows, sort, onSortChange } = useClientSort(
    itemsQuery.data?.items ?? EMPTY,
    SORT_ACCESSORS,
    { by: "name", direction: "asc" },
  );

  const deleteMutation = useMutation({
    meta: REPORTED_INLINE,
    mutationFn: (item: Item) => deleteItem(item.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ITEMS_KEY });
      setDialog({ kind: "none" });
    },
  });

  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }),
    [i18n.language],
  );

  const columns: DataTableColumn<Item>[] = [
    {
      id: "name",
      header: t("items.fields.name"),
      sortable: true,
      renderCell: (item) => (
        <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: "break-word" }}>
          {item.name}
        </Typography>
      ),
    },
    {
      id: "description",
      header: t("items.fields.description"),
      renderCell: (item) =>
        item.description ? (
          <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
            {item.description}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            —
          </Typography>
        ),
    },
    {
      id: "updatedAt",
      header: t("items.fields.updatedAt"),
      sortable: true,
      renderCell: (item) => (
        <Box component="time" dateTime={item.updatedAt} sx={{ whiteSpace: "nowrap" }}>
          {dateFormat.format(new Date(item.updatedAt))}
        </Box>
      ),
    },
    {
      id: "actions",
      header: t("items.fields.actions"),
      headerHidden: true,
      align: "right",
      renderCell: (item) => (
        <Stack direction="row" justifyContent="flex-end" gap={0.5}>
          <Tooltip title={t("items.edit", { name: item.name })}>
            <IconButton
              size="small"
              aria-label={t("items.edit", { name: item.name })}
              onClick={() => setDialog({ kind: "edit", item })}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t("items.delete", { name: item.name })}>
            <IconButton
              size="small"
              aria-label={t("items.delete", { name: item.name })}
              onClick={() => {
                deleteMutation.reset();
                setDialog({ kind: "delete", item });
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t("items.title")}
        subtitle={t("items.subtitle")}
        state={pageStateOf(itemsQuery)}
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialog({ kind: "create" })}
          >
            {t("items.create")}
          </Button>
        }
      />

      {itemsQuery.isError ? (
        <Box sx={{ mb: 2 }}>
          <ApiErrorBanner error={itemsQuery.error} />
        </Box>
      ) : null}

      {itemsQuery.isSuccess ? (
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(item) => item.id}
          caption={t("items.caption")}
          emptyMessage={t("items.empty")}
          sort={sort}
          onSortChange={onSortChange}
          footerNote={t("items.count", { count: rows.length })}
        />
      ) : null}

      {dialog.kind === "create" || dialog.kind === "edit" ? (
        <ItemDialog
          key={dialog.kind === "edit" ? dialog.item.id : "new"}
          item={dialog.kind === "edit" ? dialog.item : undefined}
          onClose={() => setDialog({ kind: "none" })}
        />
      ) : null}

      <ConfirmDialog
        open={dialog.kind === "delete"}
        title={t("items.deleteDialog.title")}
        message={
          dialog.kind === "delete"
            ? t("items.deleteDialog.message", { name: dialog.item.name })
            : ""
        }
        confirmLabel={t("common.delete")}
        destructive
        pending={deleteMutation.isPending}
        onCancel={() => setDialog({ kind: "none" })}
        onConfirm={() => {
          if (dialog.kind === "delete") deleteMutation.mutate(dialog.item);
        }}
      >
        {deleteMutation.isError ? (
          <Box sx={{ mt: 2 }}>
            <ApiErrorBanner error={deleteMutation.error} />
          </Box>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
