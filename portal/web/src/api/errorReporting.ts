import { ApiError } from "./errors";

/**
 * The portal's safety net: no request failure may reach a user as nothing at
 * all.
 *
 * React Query v5 has no `logger` option, so a rejected mutation with no
 * `onError` and no rendered `isError` produces zero output of any kind — the
 * button looks dead and not even the console says why. The per-screen pattern
 * (remember to render `mutation.error`) is easy to forget, so the default is
 * inverted here: **every** failure is reported unless a screen declares it is
 * already reporting it inline (`meta: REPORTED_INLINE`). Forgetting then
 * produces a duplicate report, which review catches, rather than silence, which
 * it does not.
 *
 * Deliberately free of React so the `QueryClient`'s caches — built at module
 * scope in `App.tsx`, outside any component — can call into it.
 */

/** Which cache raised it. Mutations are shown; queries are logged. See below. */
export type ErrorSource = "mutation" | "query";

export interface ReportedError {
  /** Monotonic, so an identical message re-reported is still a new event. */
  id: number;
  source: ErrorSource;
  /** The safe human message — `ApiError.detail`, never a stack. */
  detail: string;
  code: string | undefined;
  correlationId: string | undefined;
  status: number | undefined;
}

type Listener = (error: ReportedError) => void;

const listeners = new Set<Listener>();
let nextId = 1;

/**
 * What a screen puts in a mutation's `meta` to say it renders the failure
 * itself, so the global net logs it but shows nothing.
 *
 * Extends `Record<string, unknown>` because React Query's `meta` is typed that
 * way.
 */
export interface ErrorReportingMeta extends Record<string, unknown> {
  errorReportedInline?: boolean;
}

/**
 * The opt-out marker: `meta: REPORTED_INLINE` on a mutation whose screen renders
 * its `isError` into an `ApiErrorBanner`.
 *
 * A shared constant rather than an inline `{ errorReportedInline: true }`: a
 * property you never write is a property you cannot misspell. Misspelling it
 * inline would compile — `meta` accepts any string key — and would silently
 * double-report. It also makes the set greppable: `grep -rn REPORTED_INLINE
 * src/` is the inventory of screens that report their own failures, and
 * `errorReportingInventory.test.ts` pins the rest.
 */
export const REPORTED_INLINE: ErrorReportingMeta = { errorReportedInline: true };

export function isReportedInline(meta: ErrorReportingMeta | undefined): boolean {
  return meta?.errorReportedInline === true;
}

export function subscribeToErrors(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Stands in for a transport failure's own message. Not localized: this is the
 * sentinel the snackbar translates, and keeping it a stable identifier rather
 * than prose is what lets a test assert on it.
 */
export const TRANSPORT_FAILURE = "__transport_failure__";

/**
 * Reduces a thrown value to the safe fields.
 *
 * A non-`ApiError` is a transport failure, and its `message` is a browser string
 * that can name an internal URL — so it is replaced rather than passed through,
 * and the `Error` object itself is never handed to the console, because that is
 * what prints a stack.
 */
function describe(error: unknown, source: ErrorSource): ReportedError {
  if (error instanceof ApiError) {
    return {
      id: nextId++,
      source,
      detail: error.detail,
      code: error.code,
      correlationId: error.correlationId,
      status: error.status,
    };
  }
  return {
    id: nextId++,
    source,
    detail: TRANSPORT_FAILURE,
    code: undefined,
    correlationId: undefined,
    status: undefined,
  };
}

/**
 * Records a failure without showing it.
 *
 * The log always happens — for either source, inline or not. Someone reading
 * devtools after the fact needs the correlation id to find the request in the
 * server logs, and an inline banner that has since been dismissed leaves no
 * trace otherwise.
 *
 * This is the whole treatment a **query** failure gets: every screen renders
 * its own read failure as a page state, so a snackbar beside it would be a
 * double report.
 */
export function logFailure(error: unknown, source: ErrorSource): ReportedError {
  const reported = describe(error, source);

  // Field-by-field, never the error object: `console.error(err)` prints a stack.
  console.error(
    `[portal] ${source} failed`,
    JSON.stringify({
      status: reported.status,
      code: reported.code,
      correlationId: reported.correlationId,
      detail: reported.detail,
    }),
  );
  return reported;
}

/**
 * Logs a failure and shows it, unless the screen reports it inline.
 *
 * Used for **mutations**, because a mutation is the thing the user just asked
 * for and the thing no screen renders reliably.
 */
export function reportError(
  error: unknown,
  source: ErrorSource,
  options: { reportedInline?: boolean } = {},
): ReportedError {
  const reported = logFailure(error, source);
  if (!options.reportedInline) {
    for (const listener of listeners) listener(reported);
  }
  return reported;
}

/** Test seam: drops every subscriber so one suite cannot leak into the next. */
export function resetErrorReporting(): void {
  listeners.clear();
}
