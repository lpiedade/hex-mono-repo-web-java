package com.example.app.portal.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.app.portal.config.PortalProperties.Auth;
import com.example.app.portal.config.PortalProperties.Mode;
import com.example.app.portal.config.PortalProperties.Oidc;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * The derived values of the BFF's configuration: a clean API base URL to join paths to, an
 * OIDC callback that follows the request unless a public origin is configured, and a dev
 * token that counts only when it is not blank.
 */
class PortalPropertiesTest {

    private static PortalProperties withBaseUrl(String apiBaseUrl) {
        return new PortalProperties(apiBaseUrl, 1, Duration.ofSeconds(1), new Auth(Mode.DEV, "t"),
                new Oidc(null, null, null, List.of(), null));
    }

    @Test
    void theApiBaseUrlLosesItsTrailingSlash() {
        assertThat(withBaseUrl("http://api:8080/").normalizedApiBaseUrl()).isEqualTo("http://api:8080");
        assertThat(withBaseUrl("http://api:8080").normalizedApiBaseUrl()).isEqualTo("http://api:8080");
    }

    @Test
    void theCallbackIsDerivedFromTheRequestUnlessAPublicOriginIsGiven() {
        String callback = "/app/bff/login/oauth2/code";

        assertThat(new Oidc(null, null, null, List.of(), null).redirectUri(callback))
                .isEqualTo("{baseUrl}/app/bff/login/oauth2/code/{registrationId}");
        assertThat(new Oidc(null, null, null, List.of(), "https://app.example.com/").redirectUri(callback))
                .isEqualTo("https://app.example.com/app/bff/login/oauth2/code/{registrationId}");
    }

    @Test
    void theDevTokenMustBeNonBlank() {
        assertThat(new Auth(Mode.DEV, "  ").hasDevToken()).isFalse();
        assertThat(new Auth(Mode.DEV, "t").hasDevToken()).isTrue();
    }
}
