package com.example.app.domain.error;

/**
 * A well-known application error: what kind of failure it is, plus the stable,
 * non-sensitive fields that describe it.
 *
 * <p>It carries a {@link ProblemKind} rather than an HTTP status so that flows
 * can classify a failure without importing a transport. The inbound adapter maps
 * the kind onto a status code at the edge.
 *
 * <p>The constants here are the ones every surface shares. A subdomain declares
 * its own next to its exceptions — see {@code domain.item.ItemProblems}.
 *
 * @param kind   what kind of failure this is
 * @param code   stable machine-readable error code
 * @param title  short, human-readable, non-sensitive summary
 * @param detail safe, generic explanation (never echoes exception text)
 */
public record ApplicationProblem(ProblemKind kind, String code, String title, String detail) {

    public static final ApplicationProblem UNAUTHENTICATED = new ApplicationProblem(
            ProblemKind.UNAUTHENTICATED,
            "UNAUTHENTICATED",
            "Unauthorized",
            "A valid bearer token is required to access this resource.");

    public static final ApplicationProblem FORBIDDEN = new ApplicationProblem(
            ProblemKind.FORBIDDEN,
            "FORBIDDEN",
            "Forbidden",
            "You do not have permission to access this resource.");

    public static final ApplicationProblem NOT_FOUND = new ApplicationProblem(
            ProblemKind.NOT_FOUND,
            "NOT_FOUND",
            "Not Found",
            "The requested resource does not exist.");

    public static final ApplicationProblem BAD_REQUEST = new ApplicationProblem(
            ProblemKind.BAD_REQUEST,
            "BAD_REQUEST",
            "Bad Request",
            "The request could not be processed as submitted.");

    public static final ApplicationProblem VALIDATION_FAILED = new ApplicationProblem(
            ProblemKind.UNPROCESSABLE,
            "VALIDATION_FAILED",
            "Unprocessable Entity",
            "The request is well-formed but its values cannot be accepted.");

    public static final ApplicationProblem INTERNAL_ERROR = new ApplicationProblem(
            ProblemKind.INTERNAL,
            "INTERNAL_ERROR",
            "Internal Server Error",
            "An unexpected error occurred.");
}
