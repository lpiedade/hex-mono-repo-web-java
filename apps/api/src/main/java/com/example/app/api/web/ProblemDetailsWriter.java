package com.example.app.api.web;

import com.example.app.api.contract.model.ProblemDetails;
import com.example.app.domain.error.ApplicationProblem;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.http.MediaType;
import tools.jackson.databind.ObjectMapper;

/**
 * Serializes a Problem Details body directly onto a servlet response. Used by the
 * security entry point and access-denied handler, which run outside Spring MVC's
 * message-converter pipeline and so must write the response themselves.
 */
public final class ProblemDetailsWriter {

    private ProblemDetailsWriter() {
    }

    public static void write(
            ObjectMapper objectMapper,
            HttpServletRequest request,
            HttpServletResponse response,
            ApplicationProblem problem)
            throws IOException {
        String correlationId = CorrelationId.resolve(request);
        ProblemDetails body = ProblemDetailsFactory.of(problem, correlationId);

        response.setStatus(ProblemStatus.of(problem.kind()).value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setHeader(CorrelationId.HEADER, correlationId);
        objectMapper.writeValue(response.getOutputStream(), body);
    }
}
