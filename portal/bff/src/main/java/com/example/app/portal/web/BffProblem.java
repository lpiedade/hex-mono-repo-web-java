package com.example.app.portal.web;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import org.springframework.http.MediaType;
import org.springframework.util.StreamUtils;
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

    /** A BFF path nothing maps: the BFF's own 404, not Spring's default error body. */
    public static BffProblem notFound(String correlationId, int portalApiVersion) {
        return new BffProblem(ABOUT_BLANK, "Not Found", 404,
                "The requested resource does not exist.", "NOT_FOUND", correlationId, portalApiVersion);
    }

    /** A failure the BFF did not expect. The detail stays generic; the log has the cause. */
    public static BffProblem internal(String correlationId, int portalApiVersion) {
        return new BffProblem(ABOUT_BLANK, "Internal Server Error", 500,
                "An unexpected error occurred.", "INTERNAL_ERROR", correlationId, portalApiVersion);
    }

    /**
     * The identity provider's callback could not complete a login. Answered as a body
     * rather than a redirect back to the SPA: the SPA would find no session and send the
     * browser to the provider again, which would fail again — a loop.
     */
    public static BffProblem loginFailed(String correlationId, int portalApiVersion) {
        return new BffProblem(ABOUT_BLANK, "Unauthorized", 401,
                "Sign-in could not be completed. Close this page and try again.",
                "LOGIN_FAILED", correlationId, portalApiVersion);
    }

    /** A status Spring MVC already decided (405, 415…), rendered in the BFF's shape. */
    public static BffProblem ofStatus(int status, String title, String correlationId, int portalApiVersion) {
        String code = title.toUpperCase(java.util.Locale.ROOT).replace(' ', '_');
        return new BffProblem(ABOUT_BLANK, title, status,
                "The request cannot be served as sent.", code, correlationId, portalApiVersion);
    }

    /** Writes this problem onto a raw servlet response, for filters outside Spring MVC. */
    public void writeTo(HttpServletResponse response, ObjectMapper objectMapper) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        // Left open, as Spring MVC does: a closed servlet stream completes the response
        // before BffRequestLogFilter writes its access line.
        objectMapper.writeValue(StreamUtils.nonClosing(response.getOutputStream()), this);
    }
}
