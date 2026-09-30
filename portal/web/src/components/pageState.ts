/**
 * The explicit page-state model every screen supports. `ready` is the normal
 * content state; the others surface as a shared notice under the heading
 * (`PageHeader`) so users get consistent loading/empty/degraded/error feedback.
 */
export type PageState =
  "ready" | "loading" | "empty" | "partial" | "stale" | "unavailable" | "forbidden" | "error";

/**
 * Maps a query's loading/error flags onto the page-state vocabulary.
 *
 * Every data-backed screen needs the same three-way choice, and writing it
 * inline invites one screen to drift — reporting an error as "empty", say,
 * which reads as "there is nothing" rather than "we could not tell".
 */
export function pageStateOf(query: { isLoading: boolean; isError: boolean }): PageState {
  if (query.isLoading) return "loading";
  if (query.isError) return "unavailable";
  return "ready";
}

/** The non-ready states of the shared page-state pattern. */
export const PAGE_STATES: readonly Exclude<PageState, "ready">[] = [
  "loading",
  "empty",
  "partial",
  "stale",
  "unavailable",
  "forbidden",
  "error",
] as const;
