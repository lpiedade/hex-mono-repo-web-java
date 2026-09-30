package com.example.app.api.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;

class CorsPropertiesTest {

    @Test
    void disabledWithoutOrigins() {
        assertThat(new CorsProperties(null, false).isEnabled()).isFalse();
        assertThat(new CorsProperties(List.of(), false).isEnabled()).isFalse();
    }

    @Test
    void enabledWithAnExplicitOrigin() {
        assertThat(new CorsProperties(List.of("https://example.com"), true).isEnabled()).isTrue();
    }

    @Test
    void aCredentialedWildcardFailsStartup() {
        assertThatThrownBy(() -> new CorsProperties(List.of("*"), true))
                .isInstanceOf(IllegalStateException.class);
        assertThat(new CorsProperties(List.of("*"), false).isEnabled()).isTrue();
    }
}
