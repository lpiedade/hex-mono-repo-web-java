import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { isReportedInline, logFailure, reportError } from "./api/errorReporting";

/**
 * No request failure is silent (ADR-012).
 *
 * A factory rather than a module-level literal so `errorReporting.test.tsx`
 * exercises *this* wiring instead of a copy of it — a test that rebuilt the
 * caches itself would keep passing after someone removed them from here. A
 * module of its own, not an export of `App.tsx`, because a file that exports a
 * component exports only components (Fast Refresh).
 *
 * Both caches report; only one of them shows anything, and the asymmetry is the
 * point:
 *
 * - A **mutation** is what the user just asked for, and the thing no screen
 *   renders reliably. So a failure is shown as well as logged, and a screen that
 *   renders it itself opts out with `meta: REPORTED_INLINE` to keep one failure
 *   to one visible report.
 * - A **query** is logged only: every screen renders its read failure as a page
 *   state, so a snackbar beside it would be a double report.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        reportError(error, "mutation", {
          reportedInline: isReportedInline(mutation.options.meta),
        });
      },
    }),
    queryCache: new QueryCache({
      onError: (error) => {
        logFailure(error, "query");
      },
    }),
  });
}
