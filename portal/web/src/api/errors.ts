/** A field-level validation error, as the API's Problem Details carries it. */
export interface FieldError {
  field: string;
  code: string;
  message?: string;
}

/**
 * The subset of an RFC 9457 Problem Details body the portal reads. Both the
 * API's `ProblemDetails` and the BFF's own `BffProblem` fit it.
 */
export interface ProblemDetail {
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  correlationId?: string;
  errors?: FieldError[];
}

/** Stable codes the BFF itself answers with (portal-api-v1.yaml). */
/** No browser session (oidc mode). Distinct from the API's own `UNAUTHENTICATED`. */
export const SESSION_REQUIRED = "SESSION_REQUIRED";
export const UPSTREAM_UNAVAILABLE = "UPSTREAM_UNAVAILABLE";

/** Typed error carrying a Problem Details payload from the BFF/API. */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;
  readonly code: string | undefined;
  readonly correlationId: string | undefined;
  readonly title: string | undefined;
  readonly fieldErrors: readonly FieldError[];

  constructor(status: number, problem: ProblemDetail) {
    const msg = problem.detail ?? problem.title ?? `HTTP ${status}`;
    super(msg);
    this.name = "ApiError";
    this.status = status;
    this.detail = msg;
    this.code = problem.code;
    this.correlationId = problem.correlationId;
    this.title = problem.title;
    this.fieldErrors = Array.isArray(problem.errors) ? problem.errors : [];
  }

  /**
   * The BFF could not reach the application API. The API may be restarting or
   * down; the request itself was not refused, so the UI says "try again" rather
   * than showing a detail written for a rejection.
   */
  get upstreamUnavailable(): boolean {
    return this.status === 503 && this.code === UPSTREAM_UNAVAILABLE;
  }
}

export function toApiError(status: number, body: unknown): ApiError {
  const p = body && typeof body === "object" ? (body as ProblemDetail) : {};
  return new ApiError(status, p);
}
