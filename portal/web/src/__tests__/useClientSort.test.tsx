import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
// Imported for its side effect: initialises i18next, which the hook reads for
// the active locale's collation.
import "../i18n";
import { useClientSort, type SortAccessors } from "../components/useClientSort";

/**
 * In-memory sorting for a collection the screen already holds whole.
 *
 * The cases here are the ones a naive `rows.sort((a, b) => a.x > b.x ? 1 : -1)`
 * gets wrong: accented
 * text filed after `z`, "v10" before "v2", a date column ordered by its
 * dd/mm/yyyy rendering, absent values promoted to the top on reverse, and the
 * React Query cache mutated in place.
 */
interface Row {
  name: string;
  version?: string;
  updatedAt: Date;
}

const ACCESSORS: SortAccessors<Row> = {
  name: (r) => r.name,
  version: (r) => r.version,
  updatedAt: (r) => r.updatedAt,
};

function rowsOf(result: { current: { rows: Row[] } }): string[] {
  return result.current.rows.map((r) => r.name);
}

function row(name: string, version?: string, updatedAt = "2026-01-01"): Row {
  return { name, version, updatedAt: new Date(updatedAt) };
}

describe("useClientSort", () => {
  it("leaves the backend's order untouched until a column is chosen", () => {
    const rows = [row("zebra"), row("alpha")];
    const { result } = renderHook(() => useClientSort(rows, ACCESSORS));

    expect(rowsOf(result)).toEqual(["zebra", "alpha"]);
    expect(result.current.sort).toBeUndefined();
  });

  it("sorts ascending on the first click and reverses on the second", () => {
    const rows = [row("zebra"), row("alpha"), row("mike")];
    const { result } = renderHook(() => useClientSort(rows, ACCESSORS));

    act(() => result.current.onSortChange("name"));
    expect(rowsOf(result)).toEqual(["alpha", "mike", "zebra"]);
    expect(result.current.sort).toEqual({ by: "name", direction: "asc" });

    act(() => result.current.onSortChange("name"));
    expect(rowsOf(result)).toEqual(["zebra", "mike", "alpha"]);
    expect(result.current.sort).toEqual({ by: "name", direction: "desc" });
  });

  it("restarts at ascending when a different column is chosen", () => {
    const rows = [row("zebra"), row("alpha")];
    const { result } = renderHook(() => useClientSort(rows, ACCESSORS));

    act(() => result.current.onSortChange("name"));
    act(() => result.current.onSortChange("name"));
    act(() => result.current.onSortChange("version"));

    expect(result.current.sort).toEqual({ by: "version", direction: "asc" });
  });

  // Code-unit comparison files "Área" after "Zebra", because the accented
  // letters sit above `z` in Unicode. The locale's collator is the difference.
  it("orders accented text by the locale's collation, not by code unit", () => {
    const rows = [row("Zebra"), row("Área"), row("Banco")];
    const { result } = renderHook(() =>
      useClientSort(rows, ACCESSORS, { by: "name", direction: "asc" }),
    );

    expect(rowsOf(result)).toEqual(["Área", "Banco", "Zebra"]);
  });

  // Lexically "v10" precedes "v2". Every identifier-shaped column wants the
  // numeric reading, which `Intl.Collator({ numeric: true })` supplies.
  it("orders embedded numbers numerically", () => {
    const rows = [row("b", "v10"), row("a", "v2"), row("c", "v1")];
    const { result } = renderHook(() =>
      useClientSort(rows, ACCESSORS, { by: "version", direction: "asc" }),
    );

    expect(rowsOf(result)).toEqual(["c", "a", "b"]);
  });

  it("sorts dates by their instant", () => {
    const rows = [
      row("older", undefined, "2026-03-01"),
      row("newest", undefined, "2026-12-31"),
      row("oldest", undefined, "2025-06-15"),
    ];
    const { result } = renderHook(() =>
      useClientSort(rows, ACCESSORS, { by: "updatedAt", direction: "desc" }),
    );

    expect(rowsOf(result)).toEqual(["newest", "older", "oldest"]);
  });

  // The rule that makes a reversed column readable: an absent value is not a
  // small one, so it must not float to the top when the direction flips.
  it("keeps absent values last in both directions", () => {
    const rows = [row("none"), row("has", "v3"), row("also-has", "v1")];
    const { result } = renderHook(() => useClientSort(rows, ACCESSORS));

    act(() => result.current.onSortChange("version"));
    expect(rowsOf(result)).toEqual(["also-has", "has", "none"]);

    act(() => result.current.onSortChange("version"));
    expect(rowsOf(result)).toEqual(["has", "also-has", "none"]);
  });

  // `Array.prototype.sort` mutates. `rows` is the array React Query holds, so
  // sorting it directly reorders every other reader of that query.
  it("does not mutate the array it was given", () => {
    const rows = [row("zebra"), row("alpha")];
    const { result } = renderHook(() => useClientSort(rows, ACCESSORS));

    act(() => result.current.onSortChange("name"));

    expect(rows.map((r) => r.name)).toEqual(["zebra", "alpha"]);
    expect(result.current.rows).not.toBe(rows);
  });

  it("falls back to the given order for a column with no accessor", () => {
    const rows = [row("zebra"), row("alpha")];
    const { result } = renderHook(() => useClientSort(rows, ACCESSORS));

    act(() => result.current.onSortChange("unmapped"));

    expect(rowsOf(result)).toEqual(["zebra", "alpha"]);
  });
});
