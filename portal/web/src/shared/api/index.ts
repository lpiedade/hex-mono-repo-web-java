/**
 * Public API of `shared/api` — the only way to the BFF (portal/CLAUDE.md,
 * ADR-012). Every call goes through `client.ts`'s typed client and its
 * middleware (`auth.ts`); a failure becomes an `ApiError`, and the global net
 * (`errorReporting.ts`) makes sure none is silent.
 *
 * The contract's types are generated into `generated/` and never imported from
 * there by name outside this segment: the aliases below are the vocabulary the
 * rest of the SPA uses.
 */
export {
  createItem,
  deleteItem,
  getApiAbout,
  getBffAbout,
  getItem,
  getUserContext,
  listItems,
  logout,
  updateItem,
  type Item,
  type ItemRequest,
  type UserContext,
} from "./client";
export {
  APP_BASE_PATH,
  browser,
  LOGIN_PATH,
  readCookie,
  resetLoginRedirect,
  XSRF_COOKIE,
  XSRF_HEADER,
} from "./auth";
export {
  ApiError,
  SESSION_REQUIRED,
  toApiError,
  UPSTREAM_UNAVAILABLE,
  type FieldError,
  type ProblemDetail,
} from "./apiError";
export {
  isReportedInline,
  logFailure,
  REPORTED_INLINE,
  reportError,
  resetErrorReporting,
  subscribeToErrors,
  TRANSPORT_FAILURE,
  type ErrorReportingMeta,
  type ErrorSource,
  type ReportedError,
} from "./errorReporting";
