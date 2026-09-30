/**
 * Public API of `shared/ui` — the composed primitives every screen builds on
 * (ADR-013). They carry the semantics so screens do not have to: one `h1` per
 * page through `PageHeader`, named regions through `SectionCard`, captioned
 * tables with `aria-sort` through `DataTable`, live regions through `Banner`.
 * None of them fetches anything, and none localizes the copy it is handed.
 *
 * `useClientSort` lives here, beside `DataTable`, because it is part of that
 * table's contract and typed by it (ADR-024).
 */
export { ApiErrorBanner } from "./ApiErrorBanner";
export { Banner, type BannerSeverity } from "./Banner";
export { ConfirmDialog } from "./ConfirmDialog";
export {
  DataTable,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type DataTableColumn,
  type DataTableSort,
  type SortDirection,
} from "./DataTable";
export { FooterNote } from "./FooterNote";
export { GlobalErrorSnackbar } from "./GlobalErrorSnackbar";
export { KeyValueList, type KeyValueItem } from "./KeyValueList";
export { PageHeader, PageStateNotice } from "./PageHeader";
export { SectionCard } from "./SectionCard";
export { useClientSort, type SortAccessors, type SortValue } from "./useClientSort";
