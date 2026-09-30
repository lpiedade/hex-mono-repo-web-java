import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Typography,
} from "@mui/material";
import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { FooterNote } from "./FooterNote";
import { visuallyHidden } from "@/shared/lib";

export type SortDirection = "asc" | "desc";

export interface DataTableColumn<Row> {
  /** Stable column id; also the sort key a paged screen sends to the backend. */
  id: string;
  header: string;
  /**
   * Renders {@link header} `visuallyHidden` inside the `th`, so the column keeps
   * its accessible name while costing only the width of its cells — for an
   * icon or actions gutter. The `th` is still announced, which an empty header
   * would not be.
   */
  headerHidden?: boolean;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  /**
   * Renders one cell. Return escaped React nodes only — never
   * `dangerouslySetInnerHTML` or raw markup from API content.
   */
  renderCell: (row: Row) => ReactNode;
}

export interface DataTableSort {
  by: string;
  direction: SortDirection;
}

/** Lists default to 25 rows per page; the ceiling is 100. */
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
const DEFAULT_ROWS_PER_PAGE_OPTIONS: readonly number[] = [25, 50, 100];

interface DataTableProps<Row> {
  columns: DataTableColumn<Row>[];
  /** The rows to render, already in their final order (see {@link sort}). */
  rows: Row[];
  getRowKey: (row: Row) => string;
  /**
   * Accessible name for the table, rendered as a `<caption>` — visually hidden
   * by default so it does not duplicate an enclosing heading.
   */
  caption: string;
  captionVisible?: boolean;
  emptyMessage?: string;
  /** Note under the table (e.g. "showing 25 of 340"). */
  footerNote?: ReactNode;

  /**
   * Controlled sort state and handler. The table never sorts `rows` itself —
   * it renders the order it is given and reports the clicked column.
   *
   * Who does the sorting depends on who holds the collection: a screen that
   * fetched the list whole sorts in memory through `useClientSort`; a screen
   * that pages through the backend sends the sort with its next request.
   * Sorting a page in memory reorders that page and not the list, so the two
   * are never mixed.
   */
  sort?: DataTableSort;
  onSortChange?: (columnId: string) => void;

  /**
   * Controlled pagination. All four are required to show the pager: 0-based
   * `page`, `rowsPerPage`, the total `rowCount`, and `onPageChange`.
   */
  page?: number;
  rowsPerPage?: number;
  rowCount?: number;
  rowsPerPageOptions?: readonly number[];
  onPageChange?: (page: number) => void;
  onRowsPerPageChange?: (rowsPerPage: number) => void;
  /** Ceiling applied to {@link rowsPerPageOptions} and to the value the select reports. */
  maxPageSize?: number;
  /**
   * Set when the backend paginates by keyset rather than by offset. Only the
   * first page and the ones adjacent to the current one are addressable, so the
   * jump-to-last control is withdrawn rather than left to do nothing.
   */
  sequentialPaging?: boolean;

  /** Id placed on the `<table>`, so something else can `aria-describedby` it. */
  id?: string;
  /** Keeps the table in the accessibility tree but out of the layout. */
  visuallyHidden?: boolean;
}

/**
 * The accessible table primitive: semantic `table`/`th` markup, a `<caption>`
 * for the accessible name, sortable headers that expose `aria-sort` and
 * announce changes in a polite live region, hover rows, and bounded
 * keyboard-operable pagination. Sort and pagination are controlled — the table
 * reorders nothing and fetches nothing; it renders what it is handed and
 * reports the click. Cell content is escaped plain text.
 */
export function DataTable<Row>({
  columns,
  rows,
  getRowKey,
  caption,
  captionVisible = false,
  emptyMessage,
  footerNote,
  sort,
  onSortChange,
  page,
  rowsPerPage,
  rowCount,
  rowsPerPageOptions = DEFAULT_ROWS_PER_PAGE_OPTIONS,
  onPageChange,
  onRowsPerPageChange,
  maxPageSize = MAX_PAGE_SIZE,
  sequentialPaging = false,
  id,
  visuallyHidden: hidden = false,
}: DataTableProps<Row>) {
  const { t } = useTranslation();
  const generatedId = useId();
  const tableId = id ?? generatedId;

  const boundedOptions = rowsPerPageOptions.filter((n) => n <= maxPageSize);

  const activeColumn = sort ? columns.find((c) => c.id === sort.by) : undefined;
  const sortMessage = sort
    ? t("table.sortAnnouncement", {
        column: activeColumn?.header ?? sort.by,
        direction: t(sort.direction === "asc" ? "table.sortedAscending" : "table.sortedDescending"),
      })
    : "";

  return (
    <Box sx={hidden ? visuallyHidden : undefined}>
      {/* Polite live region: announces the active sort when it changes. */}
      <Box role="status" aria-live="polite" sx={visuallyHidden}>
        {sortMessage}
      </Box>

      {/*
        A table with more columns than a 320px viewport can hold scrolls inside
        this container rather than widening the document. WCAG 2.2 SC 1.4.10
        allows two-dimensional scrolling for content that genuinely requires it,
        such as a data table — what it forbids is the *page* scrolling
        horizontally. `maxWidth: 100%` keeps the container inside the viewport.
      */}
      <TableContainer
        // A scrollable region has to be reachable without a pointer: a keyboard
        // user who cannot focus it cannot scroll it (WCAG 2.1.1). The caption is
        // already the table's name, so the region borrows it.
        tabIndex={0}
        role="group"
        aria-label={caption}
        sx={{
          maxWidth: "100%",
          overflowX: "auto",
          // Written in theme terms so light and dark are both served by the
          // same line; a hex here would fix one theme and break the other.
          backgroundColor: "background.paper",
          border: 1,
          borderColor: "divider",
          borderRadius: (th) => `${th.app.radii.card}px`,
          boxShadow: (th) => th.app.elevation.subtle,
        }}
      >
        <Table id={tableId} size="small">
          <Box
            component="caption"
            sx={
              captionVisible
                ? { captionSide: "top", textAlign: "left", px: 2, py: 1 }
                : visuallyHidden
            }
          >
            {caption}
          </Box>
          <TableHead>
            <TableRow>
              {columns.map((col) => {
                const active = sort?.by === col.id;
                const direction: SortDirection = active && sort ? sort.direction : "asc";
                const canSort = Boolean(col.sortable && onSortChange);
                return (
                  <TableCell
                    key={col.id}
                    align={col.align}
                    scope="col"
                    sortDirection={active ? direction : false}
                  >
                    {canSort ? (
                      <TableSortLabel
                        active={active}
                        direction={direction}
                        onClick={() => onSortChange?.(col.id)}
                      >
                        {col.header}
                        {active ? (
                          <Box component="span" sx={visuallyHidden}>
                            {direction === "asc"
                              ? t("table.sortedAscending")
                              : t("table.sortedDescending")}
                          </Box>
                        ) : null}
                      </TableSortLabel>
                    ) : col.headerHidden ? (
                      <Box component="span" sx={visuallyHidden}>
                        {col.header}
                      </Box>
                    ) : (
                      col.header
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <Typography color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                    {emptyMessage ?? t("table.empty")}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={getRowKey(row)} hover>
                  {columns.map((col) => (
                    <TableCell key={col.id} align={col.align}>
                      {col.renderCell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/*
        The pager sits outside the scrolling TableContainer, so it needs its own
        bound: its toolbar lays out wider than a 320px viewport and would widen
        the document even though the table above it does not.
      */}
      {page != null && rowsPerPage != null && rowCount != null && onPageChange != null ? (
        <TablePagination
          sx={{
            maxWidth: "100%",
            overflowX: "auto",
            "& .MuiTablePagination-toolbar": { flexWrap: "wrap", rowGap: 0.5 },
          }}
          component="div"
          count={rowCount}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={boundedOptions}
          onPageChange={(_e, next) => onPageChange(next)}
          onRowsPerPageChange={
            onRowsPerPageChange
              ? (e) => onRowsPerPageChange(Math.min(parseInt(e.target.value, 10), maxPageSize))
              : undefined
          }
          showFirstButton
          showLastButton={!sequentialPaging}
          // Native select: keyboard-operable without opening a popover.
          SelectProps={{
            native: true,
            inputProps: { "aria-label": t("table.pagination.rowsPerPage") },
          }}
          labelRowsPerPage={t("table.pagination.rowsPerPage")}
          labelDisplayedRows={({ from, to, count }) =>
            t("table.pagination.displayedRows", { from, to, count })
          }
          getItemAriaLabel={(type) => t(`table.pagination.${type}Page`)}
        />
      ) : null}

      {/* `component="div"`: a slot typed `ReactNode` may hold block content. */}
      {footerNote ? (
        <Box sx={{ mt: 1 }}>
          <FooterNote component="div">{footerNote}</FooterNote>
        </Box>
      ) : null}
    </Box>
  );
}
