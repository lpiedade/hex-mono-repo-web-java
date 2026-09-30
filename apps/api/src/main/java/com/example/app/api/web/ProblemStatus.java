package com.example.app.api.web;

import com.example.app.domain.error.ProblemKind;
import org.springframework.http.HttpStatus;

/**
 * Maps a domain {@link ProblemKind} onto the HTTP status the contract publishes for
 * it. This is the whole of what the inbound adapter adds to an
 * {@link com.example.app.domain.error.ApplicationProblem}: the transport decision that
 * {@code core} must not make.
 */
public final class ProblemStatus {

    private ProblemStatus() {
    }

    public static HttpStatus of(ProblemKind kind) {
        return switch (kind) {
            case BAD_REQUEST -> HttpStatus.BAD_REQUEST;
            case UNAUTHENTICATED -> HttpStatus.UNAUTHORIZED;
            case FORBIDDEN -> HttpStatus.FORBIDDEN;
            case NOT_FOUND -> HttpStatus.NOT_FOUND;
            case CONFLICT -> HttpStatus.CONFLICT;
            case PRECONDITION_FAILED -> HttpStatus.PRECONDITION_FAILED;
            case UNPROCESSABLE -> HttpStatus.UNPROCESSABLE_ENTITY;
            case INTERNAL -> HttpStatus.INTERNAL_SERVER_ERROR;
        };
    }
}
