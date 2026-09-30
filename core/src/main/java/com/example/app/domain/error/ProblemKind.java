package com.example.app.domain.error;

/**
 * What kind of failure a {@link ApplicationProblem} describes, in terms the
 * domain owns rather than in terms of a transport.
 *
 * <p>These names deliberately read like HTTP problem categories, because that is
 * the vocabulary the contract already speaks — but the mapping to a status code
 * lives in the inbound adapter. A CLI could render the same kinds as exit codes,
 * and neither renderer is visible from {@code core}.
 */
public enum ProblemKind {

    /** The request could not be understood or is structurally invalid. */
    BAD_REQUEST,

    /** No credential was presented, or it could not be verified. */
    UNAUTHENTICATED,

    /** The caller is known but is not permitted to perform the operation. */
    FORBIDDEN,

    /** The addressed resource does not exist. */
    NOT_FOUND,

    /** The operation conflicts with the current state of the resource. */
    CONFLICT,

    /** A supplied precondition (typically an ETag) did not hold. */
    PRECONDITION_FAILED,

    /** The request was well-formed but semantically unacceptable. */
    UNPROCESSABLE,

    /** An unexpected failure that the caller cannot act on. */
    INTERNAL
}
