package com.example.app.api.web;

import com.example.app.api.contract.model.FieldError;
import com.example.app.api.contract.model.ProblemDetails;
import com.example.app.api.contract.model.SchemaVersion;
import com.example.app.domain.error.ApplicationProblem;
import java.net.URI;
import java.util.List;

/**
 * Builds {@link ProblemDetails} bodies (RFC 9457). Every body carries the
 * {@code schemaVersion}, a stable machine-readable {@code code}, and the request
 * {@code correlationId}. The inputs come from an {@link ApplicationProblem}, whose fields
 * are safe and generic — a Problem Details body must never contain a stack trace, SQL,
 * or a secret.
 */
public final class ProblemDetailsFactory {

    private static final URI ABOUT_BLANK = URI.create("about:blank");

    private ProblemDetailsFactory() {
    }

    public static ProblemDetails of(ApplicationProblem problem, String correlationId) {
        return of(problem, ProblemStatus.of(problem.kind()).value(), correlationId, List.of());
    }

    /**
     * A body that additionally carries field-level {@code errors}. An empty list is
     * treated as no errors and omitted, so a body never carries an empty array.
     */
    public static ProblemDetails of(ApplicationProblem problem, String correlationId, List<FieldError> errors) {
        return of(problem, ProblemStatus.of(problem.kind()).value(), correlationId, errors);
    }

    /** For a status the framework decided, such as 405, that no {@code ProblemKind} names. */
    public static ProblemDetails of(
            ApplicationProblem problem, int status, String correlationId, List<FieldError> errors) {
        ProblemDetails details = new ProblemDetails(
                ABOUT_BLANK, problem.title(), status, problem.code(), SchemaVersion.NUMBER_1, correlationId);
        details.setDetail(problem.detail());
        details.setErrors(errors == null || errors.isEmpty() ? null : errors);
        return details;
    }
}
