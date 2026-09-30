package com.example.app.portal.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Optional;

/**
 * Where the bearer token the BFF relays to the API comes from — the one thing the two
 * authentication modes do differently once a request is past the security chain
 * (ADR-010). One implementation per mode, selected by {@code app.bff.auth.mode}.
 */
public interface UpstreamCredentials {

    /**
     * The token to present upstream for this request, refreshed if the mode can. Empty
     * when the caller has none.
     */
    Optional<String> bearerToken(HttpServletRequest request, HttpServletResponse response);

    /**
     * Whether a missing token means the browser has to log in, which the proxy answers
     * with {@code 401 SESSION_REQUIRED} rather than calling the API unauthenticated.
     */
    boolean sessionBound();
}
