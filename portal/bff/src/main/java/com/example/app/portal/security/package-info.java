/**
 * How the browser is authenticated (ADR-010), chosen by {@code app.bff.auth.mode}: an OIDC
 * login with tokens kept in the server-side session, or the local {@code dev} shortcut. Both
 * answer security failures as JSON the SPA can act on, and both hand the proxy its upstream
 * token through {@link UpstreamCredentials}.
 */
package com.example.app.portal.security;
