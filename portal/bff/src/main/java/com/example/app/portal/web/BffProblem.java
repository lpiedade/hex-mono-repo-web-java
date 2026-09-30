package com.example.app.portal.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import org.springframework.http.MediaType;
import tools.jackson.databind.ObjectMapper;

/**
 * A BFF-originated RFC 9457 Problem Details body. The BFF forwards the API's own problem
 * bodies unchanged; this type is only for problems the BFF itself raises. Fields are
 * safe and generic: never a stack trace, an internal URL, or a secret.
 *
 * <p>{@code SESSION_REQUIRED} is deliberately not the API's {@code UNAUTHENTICATED}: the
 * SPA logs in on the first and not on the second, because a relayed token the API
 * refuses is not fixed by logging in again, and redirecting on it would loop.
 */
public record BffProblem(
        URI type, String title, int status, String detail, String code, String correlationId, int portalApiVersion) {

    private static final URI ABOUT_BLANK = URI.create("about:blank");

    public static BffProblem upstreamUnavailable(String correlationId, int portalApiVersion) {
        return new BffProblem(ABOUT_BLANK, "Service Unavailable", 503,
                "The application API is currently unreachable. Please retry shortly.",
                "UPSTREAM_UNAVAILABLE", correlationId, portalApiVersion);
    }

    public static BffProblem sessionRequired(String correlationId, int portalApiVersion) {
        return new BffProblem(ABOUT_BLANK, "Unauthorized", 401,
                "Sign in to continue.", "SESSION_REQUIRED", correlationId, portalApiVersion);
    }

    public static BffProblem forbidden(String correlationId, int portalApiVersion) {
        return new BffProblem(ABOUT_BLANK, "Forbidden", 403,
                "The request was refused. Reload the page and try again.",
                "FORBIDDEN", correlationId, portalApiVersion);
    }

    /** Writes this problem onto a raw servlet response, for filters outside Spring MVC. */
    public void writeTo(HttpServletResponse response, ObjectMapper objectMapper) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(response.getOutputStream(), this);
    }

    /** The correlation id already resolved for {@code request}. */
    public static String correlationIdOf(HttpServletRequest request) {
        return CorrelationId.resolve(request);
    }
}
