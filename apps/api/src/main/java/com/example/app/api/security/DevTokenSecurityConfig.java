package com.example.app.api.security;

import com.example.app.api.config.AuthProperties;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;

/**
 * Security wiring for {@code app.auth.mode=dev-token} (ADR-011).
 *
 * <p>The constructor enforces two startup guards: dev-token mode is impossible under
 * the {@code prod} profile, and a token must actually be configured. Either violation
 * fails context startup rather than silently running insecurely.
 */
@Configuration(proxyBeanMethods = false)
@EnableWebSecurity
@ConditionalOnProperty(prefix = "app.auth", name = "mode", havingValue = "dev-token")
public class DevTokenSecurityConfig {

    static final Set<String> FORBIDDEN_PROFILES = Set.of("prod");

    private final AuthProperties authProperties;

    public DevTokenSecurityConfig(AuthProperties authProperties, Environment environment) {
        this.authProperties = authProperties;
        boolean forbidden = Arrays.stream(environment.getActiveProfiles())
                .map(profile -> profile.toLowerCase(Locale.ROOT))
                .anyMatch(FORBIDDEN_PROFILES::contains);
        if (forbidden) {
            throw new IllegalStateException(
                    "app.auth.mode=dev-token must not be used with the 'prod' profile active. "
                            + "Use app.auth.mode=jwt with APP_AUTH_ISSUER_URI.");
        }
        if (!authProperties.hasDevToken()) {
            throw new IllegalStateException(
                    "app.auth.dev-token is required when app.auth.mode=dev-token; "
                            + "supply it via the APP_AUTH_DEV_TOKEN environment variable.");
        }
    }

    @Bean
    public SecurityFilterChain devTokenSecurityFilterChain(
            HttpSecurity http,
            ProblemDetailsAuthenticationEntryPoint authenticationEntryPoint,
            ProblemDetailsAccessDeniedHandler accessDeniedHandler)
            throws Exception {
        // Constructed here rather than exposed as a @Bean: a Filter bean would also be
        // registered by Boot on the servlet container, outside the security chain. Added
        // before ApiAuthorization.apply, so it runs ahead of SubjectMdcFilter.
        http.addFilterBefore(
                new DevTokenAuthenticationFilter(authProperties.devToken(), authProperties.devSubject()),
                AuthorizationFilter.class);
        ApiAuthorization.apply(http, authenticationEntryPoint, accessDeniedHandler);
        return http.build();
    }
}
