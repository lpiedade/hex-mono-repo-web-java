package com.example.app.api.security;

import com.example.app.domain.security.AppRole;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;

/**
 * The part of the security chain both authentication modes share (ADR-011): which
 * paths are public, which role each operation needs, and how a refusal is rendered.
 * Only how a bearer token is <em>verified</em> differs between the modes, so keeping
 * the rules here means switching modes can never change what a role may do.
 *
 * <p>Add a line per resource as the contract grows. A path not listed falls to
 * "authenticated", which is the safe default rather than the intended one.
 */
final class ApiAuthorization {

    private ApiAuthorization() {
    }

    static void apply(
            HttpSecurity http,
            ProblemDetailsAuthenticationEntryPoint authenticationEntryPoint,
            ProblemDetailsAccessDeniedHandler accessDeniedHandler)
            throws Exception {
        http
                // Stateless bearer API: no session, so no CSRF surface. The browser's
                // CSRF protection lives in the BFF (ADR-010).
                .csrf(AbstractHttpConfigurer::disable)
                // Off unless app.cors.allowed-origins lists origins (CorsProperties).
                // withDefaults resolves the corsConfigurationSource bean by name, and
                // enabling the handler lets an OPTIONS pre-flight through without a token.
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                        .requestMatchers("/v3/api-docs", "/v3/api-docs.yaml", "/swagger-ui/**", "/swagger-ui.html")
                        .permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/items", "/api/v1/items/**")
                        .hasRole(AppRole.READER.name())
                        .requestMatchers("/api/v1/items", "/api/v1/items/**")
                        .hasRole(AppRole.EDITOR.name())
                        .anyRequest().authenticated())
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler));
    }
}
