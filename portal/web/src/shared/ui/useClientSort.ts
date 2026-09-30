import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DataTableSort } from "./DataTable";

/**
 * What an accessor may return. Anything else — an object, a React node — has no
 * defined order, and a column rendering one sorts by a field of it instead.
 */
export type SortValue = string | number | boolean | Date | null | undefined;

/** One accessor per sortable column, keyed by the column's `id`. */
export type SortAccessors<Row> = Record<string, (row: Row) => SortValue>;

/**
 * Null, undefined and the empty string sort last in **both** directions, which
 * is why `factor` is applied here rather than by the caller: an absent value is
 * not a small one, and multiplying its verdict by -1 would promote the rows
 * with nothing to show to the top of a reversed column. "—" belongs at the
 * bottom whichever way the arrow points.
 */
function compareValues(
  a: SortValue,
  b: SortValue,
  collator: Intl.Collator,
  factor: 1 | -1,
): number {
  const aAbsent = a == null || a === "";
  const bAbsent = b == null || b === "";
  if (aAbsent || bAbsent) return aAbsent && bAbsent ? 0 : aAbsent ? 1 : -1;

  return factor * comparePresent(a, b, collator);
}

/** Orders two values that are both present, in ascending order. */
function comparePresent(
  a: NonNullable<SortValue>,
  b: NonNullable<SortValue>,
  collator: Intl.Collator,
): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();

  return collator.compare(String(a), String(b));
}

/**
 * Sorts a list the screen already holds whole, without a request.
 *
 * **Only for a collection fetched in full.** If the screen pages through the
 * backend — it passes `page`/`rowCount`/`onPageChange` to {@link DataTable}, or
 * it holds a keyset cursor — this hook sorts the page rather than the list, and
 * the result looks right while being wrong. Those screens send the sort to the
 * backend instead. The test is not "few rows"; it is "is the whole collection
 * in hand".
 *
 * Returns the sorted rows plus the controlled `sort`/`onSortChange` pair
 * {@link DataTable} expects, so a call site forwards all three and writes no
 * comparison of its own.
 *
 * `accessors` must be **referentially stable** — a module-level constant, or
 * `useMemo` when it closes over props. An object literal rebuilt each render
 * re-sorts on every render and hands `DataTable` a new array each time, which
 * costs nothing in correctness and defeats every memo below it.
 *
 * ```tsx
 * const { rows, sort, onSortChange } = useClientSort(data.items, {
 *   name: (item) => item.name,
 *   updatedAt: (item) => new Date(item.updatedAt),
 * });
 * <DataTable rows={rows} sort={sort} onSortChange={onSortChange} ... />
 * ```
 */
export function useClientSort<Row>(
  rows: Row[],
  accessors: SortAccessors<Row>,
  initial?: DataTableSort,
) {
  const { i18n } = useTranslation();
  const [sort, setSort] = useState<DataTableSort | undefined>(initial);

  /*
    The active locale's collation, not `<`. Comparing strings by code unit puts
    "Área" after "Zebra" in pt-BR, because the accented letters live above `z`
    in Unicode. `numeric` additionally orders
    "item-2" before "item-10", which every identifier-shaped column wants and no
    lexical comparison gives.
  */
  const collator = useMemo(
    () => new Intl.Collator(i18n.language, { numeric: true, sensitivity: "base" }),
    [i18n.language],
  );

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const accessor = accessors[sort.by];
    if (!accessor) return rows;
    const factor = sort.direction === "asc" ? 1 : -1;
    /*
      A copy, because `Array.prototype.sort` mutates in place and `rows` is the
      array React Query holds in its cache — sorting it directly corrupts every
      other reader of that query. The sort is stable (ES2019), so rows that tie
      keep the order the backend sent, which makes the display deterministic
      across re-renders rather than merely consistent within one.
    */
    return [...rows].sort((a, b) => compareValues(accessor(a), accessor(b), collator, factor));
  }, [rows, sort, accessors, collator]);

  /**
   * First click on a column sorts it ascending; clicking the active column
   * again reverses it. There is no third state returning to unsorted — the
   * backend's order is not something the header can name, so offering a way
   * back to it would leave the control in a state no label describes.
   */
  function onSortChange(columnId: string) {
    setSort((current) => ({
      by: columnId,
      direction: current?.by === columnId && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  return { rows: sortedRows, sort, onSortChange };
}
