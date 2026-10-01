package com.example.app.portal.security;

import com.example.app.portal.config.PortalProperties;
import com.example.app.portal.web.BffProblem;
import com.example.app.portal.web.CorrelationId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.authentication.logout.LogoutSuccessHandler;
import tools.jackson.databind.ObjectMapper;

/**
 * The BFF's security answers as JSON rather than redirects: the SPA calls with
 * {@code fetch}, and a {@code 302} to a login page would be followed silently and parsed
 * as an API response. Login is a navigation the SPA starts itself.
 *
 * <p>Each answer is also a log line, on this class's logger (ADR-016), because these are
 * the events that tell an operator something is wrong before a user does: a burst of CSRF
 * refusals (a broken SPA, or an attack), failed logins (a misconfigured identity
 * provider), sessions expiring faster than expected. No line carries a token, a cookie or
 * a session id.
 */
final class BffSecurityHandlers {

    private static final Logger log = LoggerFactory.getLogger(BffSecurityHandlers.class);

    private BffSecurityHandlers() {
    }

    /** No session on a call that needs one: routine (a first visit, an expiry), so INFO. */
    static AuthenticationEntryPoint sessionRequired(PortalProperties properties, ObjectMapper objectMapper) {
        return (request, response, exception) -> {
            log.info("Session required: {} {}", request.getMethod(), request.getRequestURI());
            BffProblem.sessionRequired(CorrelationId.resolve(request), properties.portalApiVersion())
                    .writeTo(response, objectMapper);
        };
    }

    /**
     * A {@code 403 FORBIDDEN} — in practice a missing or wrong CSRF token, which the CSRF
     * filter reports here whether or not the caller has a session, named by the exception's
     * type (for instance {@code MissingCsrfTokenException}). The OIDC chain's own rules
     * refuse no signed-in caller, and refuse an anonymous one through
     * {@link #sessionRequired}. The
     * detail tells the user to reload, which fetches a fresh token.
     */
    static AccessDeniedHandler forbidden(PortalProperties properties, ObjectMapper objectMapper) {
        return (request, response, exception) -> {
            log.warn("Request refused ({}): {} {}",
                    exception.getClass().getSimpleName(), request.getMethod(), request.getRequestURI());
            BffProblem.forbidden(CorrelationId.resolve(request), properties.portalApiVersion())
                    .writeTo(response, objectMapper);
        };
    }

    /** A completed OIDC login, then back to the SPA — not to the call that found no session. */
    static AuthenticationSuccessHandler loginSucceeded(String spaRoot) {
        SimpleUrlAuthenticationSuccessHandler redirect = new SimpleUrlAuthenticationSuccessHandler(spaRoot);
        redirect.setAlwaysUseDefaultTargetUrl(true);
        return (request, response, authentication) -> {
            log.info("Login succeeded for {}", authentication.getName());
            redirect.onAuthenticationSuccess(request, response, authentication);
        };
    }

    /**
     * The identity provider's callback did not yield a login: the user declined, the state
     * did not match, or the code exchange failed. Logged at WARN with the OAuth2 error code,
     * and answered as {@code 401 LOGIN_FAILED} — see {@link BffProblem#loginFailed}.
     */
    static AuthenticationFailureHandler loginFailed(PortalProperties properties, ObjectMapper objectMapper) {
        return (request, response, exception) -> {
            String reason = exception instanceof OAuth2AuthenticationException oauth2
                    ? oauth2.getError().getErrorCode()
                    : exception.getClass().getSimpleName();
            log.warn("Login failed: {}", reason);
            BffProblem.loginFailed(CorrelationId.resolve(request), properties.portalApiVersion())
                    .writeTo(response, objectMapper);
        };
    }

    /**
     * A completed logout, in either mode: {@code 204} rather than a redirect, logged with
     * who logged out ({@code -} in dev mode, which keeps no session to name anyone by).
     */
    static LogoutSuccessHandler loggedOut() {
        HttpStatusReturningLogoutSuccessHandler noContent = new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT);
        return (request, response, authentication) -> {
            log.info("Logged out: {}", nameOf(authentication));
            noContent.onLogoutSuccess(request, response, authentication);
        };
    }

    private static String nameOf(Authentication authentication) {
        return authentication == null ? "-" : authentication.getName();
    }
}
