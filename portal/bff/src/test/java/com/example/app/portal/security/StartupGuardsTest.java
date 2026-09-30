package com.example.app.portal.security;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.app.portal.config.PortalProperties;
import com.example.app.portal.config.PortalProperties.Auth;
import com.example.app.portal.config.PortalProperties.Mode;
import com.example.app.portal.config.PortalProperties.Oidc;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

/** Each mode refuses to start rather than run open or half-configured (ADR-010). */
class StartupGuardsTest {

    private static PortalProperties properties(Mode mode, String devToken, String issuer, String clientId) {
        return new PortalProperties("http://localhost:8080", 1, Duration.ofSeconds(10),
                new Auth(mode, devToken), new Oidc(issuer, clientId, null, List.of("openid"), null));
    }

    @Test
    void devModeRefusesTheProdProfile() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("prod");

        assertThatThrownBy(() -> new DevSecurityConfig(properties(Mode.DEV, "t", null, null), environment))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("prod");
    }

    @Test
    void devModeRefusesToRunWithoutAToken() {
        assertThatThrownBy(() -> new DevSecurityConfig(properties(Mode.DEV, " ", null, null), new MockEnvironment()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("APP_AUTH_DEV_TOKEN");
        assertThatCode(() -> new DevSecurityConfig(properties(Mode.DEV, "t", null, null), new MockEnvironment()))
                .doesNotThrowAnyException();
    }

    @Test
    void oidcModeRefusesToRunWithoutAnIssuerAndClient() {
        OidcSecurityConfig config = new OidcSecurityConfig();

        assertThatThrownBy(() -> config.clientRegistrationRepository(properties(Mode.OIDC, null, null, "portal")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("APP_OIDC_ISSUER_URI");
        assertThatThrownBy(() -> config.clientRegistrationRepository(
                        properties(Mode.OIDC, null, "https://idp.example.com", " ")))
                .isInstanceOf(IllegalStateException.class);
    }
}
