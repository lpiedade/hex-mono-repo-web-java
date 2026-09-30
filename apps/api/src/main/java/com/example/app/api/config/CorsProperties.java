package com.example.app.api.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Cross-origin resource sharing configuration.
 *
 * <p>CORS is off by default: with an empty {@link #allowedOrigins()} list the API
 * sends no CORS headers. The browser reaches the API through the same-origin BFF
 * (ADR-009), so enabling CORS is a deliberate integration choice for an explicit
 * list of origins. A credentialed wildcard fails startup, because it would let any
 * page a user's browser loads call the API with their credentials.
 */
@ConfigurationProperties(prefix = "app.cors")
public record CorsProperties(
        @DefaultValue List<String> allowedOrigins,
        @DefaultValue("false") boolean allowCredentials) {

    public CorsProperties {
        allowedOrigins = allowedOrigins == null ? List.of() : List.copyOf(allowedOrigins);
        if (allowCredentials && allowedOrigins.contains("*")) {
            throw new IllegalStateException(
                    "app.cors: a credentialed wildcard origin is not permitted. Set "
                            + "app.cors.allow-credentials=false or replace \"*\" with an explicit "
                            + "origin list.");
        }
    }

    /** Whether any origin is configured; when false the API sends no CORS headers. */
    public boolean isEnabled() {
        return !allowedOrigins.isEmpty();
    }
}
