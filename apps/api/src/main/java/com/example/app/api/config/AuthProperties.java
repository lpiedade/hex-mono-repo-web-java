package com.example.app.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Authentication configuration for the application API (ADR-011).
 *
 * <p>{@code devToken} is intentionally left without a default: it must be
 * supplied out-of-band via {@code APP_AUTH_DEV_TOKEN} and never committed.
 *
 * @param mode        how bearer tokens are verified
 * @param issuerUri   the OIDC issuer whose JWTs are accepted, for {@link AuthMode#JWT}
 * @param rolesClaim  the claim, possibly a dotted path, that carries role names
 * @param devToken    the pre-shared token, for {@link AuthMode#DEV_TOKEN}
 * @param devSubject  the subject a dev-token request is authenticated as
 */
@ConfigurationProperties(prefix = "app.auth")
public record AuthProperties(
        @DefaultValue("jwt") AuthMode mode,
        String issuerUri,
        @DefaultValue("roles") String rolesClaim,
        String devToken,
        @DefaultValue("dev@app.local") String devSubject) {

    /** Authentication strategy. Relaxed binding maps {@code dev-token} to {@link #DEV_TOKEN}. */
    public enum AuthMode {
        JWT,
        DEV_TOKEN
    }

    public boolean hasDevToken() {
        return devToken != null && !devToken.isBlank();
    }

    public boolean hasIssuerUri() {
        return issuerUri != null && !issuerUri.isBlank();
    }
}
