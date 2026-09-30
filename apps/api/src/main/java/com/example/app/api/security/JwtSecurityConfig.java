package com.example.app.api.security;

import com.example.app.api.config.AuthProperties;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.jwt.SupplierJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Security wiring for {@code app.auth.mode=jwt}, the default (ADR-011): an OAuth2
 * resource server that validates bearer JWTs from the configured issuer and maps a roles
 * claim onto {@link com.example.app.domain.security.AppRole}s.
 *
 * <p>The issuer's signing keys are discovered on first use, not at startup, so the API
 * starts while the identity provider is briefly unreachable; a missing issuer, however,
 * fails startup. A {@link JwtDecoder} bean, when one exists, takes precedence — that is
 * how the integration tests sign their own tokens.
 */
@Configuration(proxyBeanMethods = false)
@EnableWebSecurity
@ConditionalOnProperty(prefix = "app.auth", name = "mode", havingValue = "jwt", matchIfMissing = true)
public class JwtSecurityConfig {

    @Bean
    public SecurityFilterChain jwtSecurityFilterChain(
            HttpSecurity http,
            AuthProperties authProperties,
            ObjectProvider<JwtDecoder> jwtDecoders,
            ProblemDetailsAuthenticationEntryPoint authenticationEntryPoint,
            ProblemDetailsAccessDeniedHandler accessDeniedHandler)
            throws Exception {
        JwtDecoder decoder = jwtDecoders.getIfAvailable(() -> issuerDecoder(authProperties));
        ApiAuthorization.apply(http, authenticationEntryPoint, accessDeniedHandler);
        http.oauth2ResourceServer(resourceServer -> resourceServer
                .authenticationEntryPoint(authenticationEntryPoint)
                .jwt(jwt -> jwt
                        .decoder(decoder)
                        .jwtAuthenticationConverter(new JwtRolesConverter(authProperties.rolesClaim()))));
        return http.build();
    }

    private static JwtDecoder issuerDecoder(AuthProperties authProperties) {
        if (!authProperties.hasIssuerUri()) {
            throw new IllegalStateException(
                    "app.auth.issuer-uri is required when app.auth.mode=jwt; supply it via "
                            + "APP_AUTH_ISSUER_URI, or set APP_AUTH_MODE=dev-token for local development.");
        }
        String issuer = authProperties.issuerUri();
        return new SupplierJwtDecoder(() -> JwtDecoders.fromIssuerLocation(issuer));
    }
}
