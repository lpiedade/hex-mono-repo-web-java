import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { Box, Button, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { itemQueries, type Item } from "@/entities/item";
import { DeleteItemDialog } from "@/features/delete-item";
import { ItemDialog } from "@/features/edit-item";
import { pageStateOf } from "@/shared/lib";
import {
  ApiErrorBanner,
  DataTable,
  PageHeader,
  useClientSort,
  type DataTableColumn,
  type SortAccessors,
} from "@/shared/ui";

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
 * in memory (portal/CLAUDE.md, "who sorts a list"). The page composes; the
 * writes are features (`edit-item`, `delete-item`), each of which invalidates
 * the list and lets React Query re-read it — nothing is patched into the cache
 * by hand. Replace `items` with the project's first real aggregate and keep the
 * shape.
 */
export function ItemsPage() {
  const { t, i18n } = useTranslation();
  const [dialog, setDialog] = useState<Dialog>({ kind: "none" });

  const itemsQuery = useQuery(itemQueries.list());
  const { rows, sort, onSortChange } = useClientSort(
    itemsQuery.data?.items ?? EMPTY,
    SORT_ACCESSORS,
    { by: "name", direction: "asc" },
  );

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
              onClick={() => setDialog({ kind: "delete", item })}
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

      <DeleteItemDialog
        item={dialog.kind === "delete" ? dialog.item : undefined}
        onClose={() => setDialog({ kind: "none" })}
      />
    </>
  );
}
