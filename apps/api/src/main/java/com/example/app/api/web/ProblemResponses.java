package com.example.app.api.web;

import com.example.app.api.contract.model.FieldError;
import com.example.app.api.contract.model.ProblemDetails;
import com.example.app.domain.error.ApplicationProblem;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

/**
 * Builds the RFC 9457 HTTP response for an {@link ApplicationProblem}: the status, the
 * {@code X-Correlation-ID} header, the {@code application/problem+json} content type,
 * and the body — identically wherever a problem surfaces.
 */
public final class ProblemResponses {

    private ProblemResponses() {
    }

    public static ResponseEntity<ProblemDetails> of(ApplicationProblem problem, HttpServletRequest request) {
        return of(problem, List.of(), request);
    }

    public static ResponseEntity<ProblemDetails> of(
            ApplicationProblem problem, List<FieldError> errors, HttpServletRequest request) {
        String correlationId = CorrelationId.resolve(request);
        ProblemDetails body = ProblemDetailsFactory.of(problem, correlationId, errors);
        return ResponseEntity.status(body.getStatus())
                .header(CorrelationId.HEADER, correlationId)
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body(body);
    }
}
