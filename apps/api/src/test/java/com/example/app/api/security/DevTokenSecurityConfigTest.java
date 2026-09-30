package com.example.app.api.security;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.app.api.config.AuthProperties;
import com.example.app.api.config.AuthProperties.AuthMode;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

/** The two startup guards of dev-token mode (ADR-011). */
class DevTokenSecurityConfigTest {

    private static AuthProperties devToken(String token) {
        return new AuthProperties(AuthMode.DEV_TOKEN, null, "roles", token, "dev@app.local");
    }

    @Test
    void refusesToStartUnderTheProdProfile() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("PROD");

        assertThatThrownBy(() -> new DevTokenSecurityConfig(devToken("secret"), environment))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("prod");
    }

    @Test
    void refusesToStartWithoutAToken() {
        assertThatThrownBy(() -> new DevTokenSecurityConfig(devToken("  "), new MockEnvironment()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("APP_AUTH_DEV_TOKEN");
    }

    @Test
    void startsWithATokenOutsideProd() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("dev");

        assertThatCode(() -> new DevTokenSecurityConfig(devToken("secret"), environment))
                .doesNotThrowAnyException();
    }
}
