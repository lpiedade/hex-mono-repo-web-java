package com.example.app.api.security;

import com.example.app.api.web.ProblemDetailsWriter;
import com.example.app.domain.error.ApplicationProblem;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Renders a 403 RFC 9457 Problem Details body when an authenticated subject lacks the
 * role a resource requires.
 */
@Component
public class ProblemDetailsAccessDeniedHandler implements AccessDeniedHandler {

    private final ObjectMapper objectMapper;

    public ProblemDetailsAccessDeniedHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void handle(
            HttpServletRequest request, HttpServletResponse response, AccessDeniedException accessDeniedException)
            throws IOException {
        ProblemDetailsWriter.write(objectMapper, request, response, ApplicationProblem.FORBIDDEN);
    }
}
