package com.example.app.api.security;

import com.example.app.api.web.ProblemDetailsWriter;
import com.example.app.domain.error.ApplicationProblem;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Renders a 403 RFC 9457 Problem Details body when an authenticated subject lacks the
 * role a resource requires, and logs it at WARN. The subject is on the line already, from
 * the MDC ({@link SubjectMdcFilter}): a caller probing for operations it may not call, or
 * an identity provider that stopped issuing a role, shows up there first.
 */
@Component
public class ProblemDetailsAccessDeniedHandler implements AccessDeniedHandler {

    private static final Logger log = LoggerFactory.getLogger(ProblemDetailsAccessDeniedHandler.class);

    private final ObjectMapper objectMapper;

    public ProblemDetailsAccessDeniedHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void handle(
            HttpServletRequest request, HttpServletResponse response, AccessDeniedException accessDeniedException)
            throws IOException {
        log.warn("Access denied: {} {}", request.getMethod(), request.getRequestURI());
        ProblemDetailsWriter.write(objectMapper, request, response, ApplicationProblem.FORBIDDEN);
    }
}
