package com.example.app.portal.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Configuration for the BFF (ADR-009, ADR-010).
 *
 * @param apiBaseUrl       root URL of the application API, without the /api/v1 path
 * @param portalApiVersion browser-to-BFF contract version, emitted on every response
 * @param requestTimeout   upstream connect/response timeout, so an unreachable or hung
 *                         API yields a prompt 503 instead of a hang
 * @param auth             how the browser is authenticated
 * @param oidc             the identity provider, for {@link Mode#OIDC}
 */
@ConfigurationProperties(prefix = "app.bff")
public record PortalProperties(
        @DefaultValue("http://localhost:8080") String apiBaseUrl,
        @DefaultValue("1") int portalApiVersion,
        @DefaultValue("10s") Duration requestTimeout,
        @DefaultValue Auth auth,
        @DefaultValue Oidc oidc) {

    public enum Mode {
        /** Browser login through the identity provider; tokens stay in the server-side session. */
        OIDC,
        /** No login; every proxied call carries the pre-shared dev token. Local only. */
        DEV
    }

    /**
     * @param devToken never defaulted: supplied out-of-band via {@code APP_AUTH_DEV_TOKEN},
     *                 the same secret the API validates in its dev-token mode
     */
    public record Auth(@DefaultValue("oidc") Mode mode, String devToken) {

        public boolean hasDevToken() {
            return devToken != null && !devToken.isBlank();
        }
    }

    /**
     * @param publicBaseUrl the origin browsers use, e.g. {@code https://app.example.com}.
     *                      Blank means "derive it from the request", which is right when
     *                      the edge forwards the public host; set it when it does not
     *                      (CloudFront forwards the origin's host name by default), or the
     *                      OIDC callback URL points at the internal host.
     */
    public record Oidc(
            String issuerUri,
            String clientId,
            String clientSecret,
            @DefaultValue({"openid", "profile", "email"}) List<String> scopes,
            String publicBaseUrl) {

        /** The callback URL template handed to Spring Security. */
        public String redirectUri(String callbackBaseUri) {
            String base = publicBaseUrl == null || publicBaseUrl.isBlank()
                    ? "{baseUrl}"
                    : publicBaseUrl.endsWith("/") ? publicBaseUrl.substring(0, publicBaseUrl.length() - 1) : publicBaseUrl;
            return base + callbackBaseUri + "/{registrationId}";
        }
    }

    /** The API base URL with any trailing slash removed, so path joins are clean. */
    public String normalizedApiBaseUrl() {
        return apiBaseUrl.endsWith("/") ? apiBaseUrl.substring(0, apiBaseUrl.length() - 1) : apiBaseUrl;
    }
}
