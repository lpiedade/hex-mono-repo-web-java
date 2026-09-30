package com.example.app.api.security;

import com.example.app.api.web.ProblemDetailsWriter;
import com.example.app.domain.error.ApplicationProblem;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Renders a 401 RFC 9457 Problem Details body when a request reaches a protected
 * resource without valid authentication — a missing token, a wrong one, or an expired
 * JWT alike. The detail is deliberately generic and never reflects the exception.
 */
@Component
public class ProblemDetailsAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    public ProblemDetailsAuthenticationEntryPoint(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void commence(
            HttpServletRequest request, HttpServletResponse response, AuthenticationException authException)
            throws IOException {
        ProblemDetailsWriter.write(objectMapper, request, response, ApplicationProblem.UNAUTHENTICATED);
    }
}
