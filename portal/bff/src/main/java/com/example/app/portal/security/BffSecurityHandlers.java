package com.example.app.portal.security;

import com.example.app.portal.config.PortalProperties;
import com.example.app.portal.web.BffProblem;
import com.example.app.portal.web.CorrelationId;
import org.springframework.http.HttpStatus;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.authentication.logout.LogoutSuccessHandler;
import tools.jackson.databind.ObjectMapper;

/**
 * The BFF's security answers as JSON rather than redirects: the SPA calls with
 * {@code fetch}, and a {@code 302} to a login page would be followed silently and parsed
 * as an API response. Login is a navigation the SPA starts itself.
 */
final class BffSecurityHandlers {

    private BffSecurityHandlers() {
    }

    static AuthenticationEntryPoint sessionRequired(PortalProperties properties, ObjectMapper objectMapper) {
        return (request, response, exception) -> BffProblem
                .sessionRequired(CorrelationId.resolve(request), properties.portalApiVersion())
                .writeTo(response, objectMapper);
    }

    /** A refused CSRF token is the usual cause, so the detail tells the user to reload. */
    static AccessDeniedHandler forbidden(PortalProperties properties, ObjectMapper objectMapper) {
        return (request, response, exception) -> BffProblem
                .forbidden(CorrelationId.resolve(request), properties.portalApiVersion())
                .writeTo(response, objectMapper);
    }

    static LogoutSuccessHandler noContent() {
        return new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT);
    }
}
