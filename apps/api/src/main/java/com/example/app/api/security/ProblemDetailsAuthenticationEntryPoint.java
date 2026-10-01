package com.example.app.api.security;

import com.example.app.api.web.ProblemDetailsWriter;
import com.example.app.domain.error.ApplicationProblem;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.InsufficientAuthenticationException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Renders a 401 RFC 9457 Problem Details body when a request reaches a protected
 * resource without valid authentication — a missing token, a wrong one, or an expired
 * JWT alike. The body is deliberately generic and never reflects the exception.
 *
 * <p>The log line is not: it says why, so a wave of expired tokens or a wrong issuer is
 * visible from the server. A request that presented no usable credential is routine and
 * logged at INFO (in dev-token mode that includes a wrong token, which leaves the request
 * anonymous). A token that was presented and refused is logged at WARN with the reason
 * the resource server gave, which never contains the token itself.
 */
@Component
public class ProblemDetailsAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private static final Logger log = LoggerFactory.getLogger(ProblemDetailsAuthenticationEntryPoint.class);

    private final ObjectMapper objectMapper;

    public ProblemDetailsAuthenticationEntryPoint(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void commence(
            HttpServletRequest request, HttpServletResponse response, AuthenticationException authException)
            throws IOException {
        if (authException instanceof InsufficientAuthenticationException) {
            log.info("Authentication required: {} {}", request.getMethod(), request.getRequestURI());
        } else {
            log.warn("Authentication refused: {} {} ({}: {})", request.getMethod(), request.getRequestURI(),
                    authException.getClass().getSimpleName(), authException.getMessage());
        }
        ProblemDetailsWriter.write(objectMapper, request, response, ApplicationProblem.UNAUTHENTICATED);
    }
}
