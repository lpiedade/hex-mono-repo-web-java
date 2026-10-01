package com.example.app.portal.security;

import com.example.app.portal.config.PortalProperties;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * {@code app.bff.auth.mode=dev} (ADR-010): no login, no session, no CSRF — every
 * proxied call carries the pre-shared dev token, which the API accepts in its own
 * dev-token mode. For local development and the browser suites only.
 *
 * <p>Like the API, it refuses to start under the {@code prod} profile or without a
 * token, rather than silently running open or proxying unauthenticated calls.
 */
@Configuration(proxyBeanMethods = false)
@EnableWebSecurity
@ConditionalOnProperty(prefix = "app.bff.auth", name = "mode", havingValue = "dev")
public class DevSecurityConfig {

    public DevSecurityConfig(PortalProperties properties, Environment environment) {
        boolean prod = Arrays.stream(environment.getActiveProfiles())
                .anyMatch(profile -> profile.toLowerCase(Locale.ROOT).equals("prod"));
        if (prod) {
            throw new IllegalStateException(
                    "app.bff.auth.mode=dev must not be used with the 'prod' profile active.");
        }
        if (!properties.auth().hasDevToken()) {
            throw new IllegalStateException(
                    "app.bff.auth.dev-token is required when app.bff.auth.mode=dev; supply it via "
                            + "APP_AUTH_DEV_TOKEN, the same value the API's dev-token mode expects.");
        }
    }

    @Bean
    public SecurityFilterChain devSecurityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> authorize.anyRequest().permitAll())
                .logout(logout -> logout
                        .logoutUrl("/app/bff/logout")
                        .logoutSuccessHandler(BffSecurityHandlers.loggedOut()));
        return http.build();
    }

    @Bean
    public UpstreamCredentials devUpstreamCredentials(PortalProperties properties) {
        String token = properties.auth().devToken();
        return new UpstreamCredentials() {
            @Override
            public Optional<String> bearerToken(HttpServletRequest request, HttpServletResponse response) {
                return Optional.of(token);
            }

            @Override
            public boolean sessionBound() {
                return false;
            }
        };
    }
}
