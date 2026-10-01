package com.example.app.portal.security;

import com.example.app.portal.config.PortalProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.OAuth2AuthorizeRequest;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientProviderBuilder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.ClientRegistrations;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.web.HttpSessionOAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

/**
 * {@code app.bff.auth.mode=oidc}, the default (ADR-010): the BFF is an OAuth2 client
 * running the authorization-code flow against the identity provider.
 *
 * <ul>
 *   <li>Tokens live in the server-side {@code HttpSession}; the browser holds only the
 *       session cookie, which is {@code HttpOnly}.</li>
 *   <li>Login, callback, logout and the proxy all sit under {@code /app/bff}, so the edge
 *       routes that one prefix to the BFF, beside the public {@code /app/health} and
 *       {@code /app/about} (ADR-017).</li>
 *   <li>CSRF uses the SPA pattern: a readable {@code XSRF-TOKEN} cookie echoed back as
 *       {@code X-XSRF-TOKEN} on every mutating request, logout included.</li>
 *   <li>A proxied call without a session answers {@code 401 SESSION_REQUIRED} as JSON; the
 *       SPA then navigates to {@code /app/bff/oauth2/authorization/oidc}.</li>
 *   <li>A completed login always returns the browser to the SPA's root, {@code /app/}; a
 *       callback that completes no login answers {@code 401 LOGIN_FAILED} instead of
 *       redirecting. Both are {@link BffSecurityHandlers}, and both are logged.</li>
 * </ul>
 *
 * <p>The session is in memory, so more than one BFF replica needs sticky sessions or a
 * shared session store (Spring Session) — the trade-off ADR-010 records.
 */
@Configuration(proxyBeanMethods = false)
@EnableWebSecurity
@ConditionalOnProperty(prefix = "app.bff.auth", name = "mode", havingValue = "oidc", matchIfMissing = true)
public class OidcSecurityConfig {

    private static final Logger log = LoggerFactory.getLogger(OidcSecurityConfig.class);

    /** Part of the login URL the SPA navigates to; change both together. */
    static final String REGISTRATION_ID = "oidc";

    static final String AUTHORIZATION_BASE_URI = "/app/bff/oauth2/authorization";
    static final String CALLBACK_BASE_URI = "/app/bff/login/oauth2/code";

    /**
     * Built here rather than from {@code spring.security.oauth2.client.*} so that dev mode,
     * which has no identity provider, is not asked to configure one. The provider's
     * endpoints are discovered from the issuer, so it must be reachable at startup.
     */
    @Bean
    public ClientRegistrationRepository clientRegistrationRepository(PortalProperties properties) {
        PortalProperties.Oidc oidc = properties.oidc();
        if (isBlank(oidc.issuerUri()) || isBlank(oidc.clientId())) {
            throw new IllegalStateException(
                    "app.bff.oidc.issuer-uri and app.bff.oidc.client-id are required when "
                            + "app.bff.auth.mode=oidc; supply APP_OIDC_ISSUER_URI and APP_OIDC_CLIENT_ID, "
                            + "or set APP_BFF_AUTH_MODE=dev for local development.");
        }
        ClientRegistration registration = ClientRegistrations.fromIssuerLocation(oidc.issuerUri())
                .registrationId(REGISTRATION_ID)
                .clientId(oidc.clientId())
                .clientSecret(oidc.clientSecret())
                .scope(oidc.scopes())
                .redirectUri(oidc.redirectUri(CALLBACK_BASE_URI))
                .build();
        return new InMemoryClientRegistrationRepository(registration);
    }

    @Bean
    public OAuth2AuthorizedClientRepository authorizedClientRepository() {
        return new HttpSessionOAuth2AuthorizedClientRepository();
    }

    /** Hands out the session's access token, refreshing it when it has expired. */
    @Bean
    public OAuth2AuthorizedClientManager authorizedClientManager(
            ClientRegistrationRepository registrations, OAuth2AuthorizedClientRepository authorizedClients) {
        DefaultOAuth2AuthorizedClientManager manager =
                new DefaultOAuth2AuthorizedClientManager(registrations, authorizedClients);
        // Refresh only. The authorization-code grant is started by the login filter, not
        // here: asking for it from inside a proxied call would throw instead of answering
        // SESSION_REQUIRED.
        manager.setAuthorizedClientProvider(OAuth2AuthorizedClientProviderBuilder.builder()
                .refreshToken()
                .build());
        return manager;
    }

    @Bean
    public SecurityFilterChain oidcSecurityFilterChain(
            HttpSecurity http,
            PortalProperties properties,
            ObjectMapper objectMapper,
            OAuth2AuthorizedClientRepository authorizedClients)
            throws Exception {
        http
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers("/app/health", "/app/about", "/error").permitAll()
                        .anyRequest().authenticated())
                .oauth2Login(login -> login
                        .authorizationEndpoint(endpoint -> endpoint.baseUri(AUTHORIZATION_BASE_URI))
                        .redirectionEndpoint(endpoint -> endpoint.baseUri(CALLBACK_BASE_URI + "/*"))
                        .authorizedClientRepository(authorizedClients)
                        // Back to the SPA, not to the API call that found the session missing.
                        .successHandler(BffSecurityHandlers.loginSucceeded("/app/"))
                        .failureHandler(BffSecurityHandlers.loginFailed(properties, objectMapper)))
                .csrf(csrf -> csrf.spa())
                .addFilterAfter(new CsrfCookieFilter(), CsrfFilter.class)
                .logout(logout -> logout
                        .logoutUrl("/app/bff/logout")
                        .logoutSuccessHandler(BffSecurityHandlers.loggedOut()))
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(BffSecurityHandlers.sessionRequired(properties, objectMapper))
                        .accessDeniedHandler(BffSecurityHandlers.forbidden(properties, objectMapper)));
        return http.build();
    }

    @Bean
    public UpstreamCredentials oidcUpstreamCredentials(OAuth2AuthorizedClientManager manager) {
        return new UpstreamCredentials() {
            @Override
            public Optional<String> bearerToken(HttpServletRequest request, HttpServletResponse response) {
                Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
                if (!(authentication instanceof OAuth2AuthenticationToken)) {
                    return Optional.empty();
                }
                OAuth2AuthorizeRequest authorize = OAuth2AuthorizeRequest.withClientRegistrationId(REGISTRATION_ID)
                        .principal(authentication)
                        .attribute(HttpServletRequest.class.getName(), request)
                        .attribute(HttpServletResponse.class.getName(), response)
                        .build();
                // The manager refreshes an expired token when it can; when it cannot, it
                // hands back the expired one. Either way an unusable token means the
                // session is over as far as the API is concerned, so the browser logs in
                // again rather than relaying a token the API will refuse.
                OAuth2AuthorizedClient client = manager.authorize(authorize);
                if (client == null || isExpired(client.getAccessToken())) {
                    log.info("Session token expired and could not be refreshed; login required");
                    return Optional.empty();
                }
                return Optional.of(client.getAccessToken().getTokenValue());
            }

            @Override
            public boolean sessionBound() {
                return true;
            }
        };
    }

    private static boolean isExpired(OAuth2AccessToken token) {
        return token.getExpiresAt() != null && token.getExpiresAt().isBefore(Instant.now());
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    /**
     * Touches the deferred CSRF token on every request so the {@code XSRF-TOKEN} cookie
     * is issued before the SPA's first mutating call, not only after a request that
     * happened to read it.
     */
    static final class CsrfCookieFilter extends OncePerRequestFilter {

        @Override
        protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                throws ServletException, IOException {
            if (request.getAttribute(CsrfToken.class.getName()) instanceof CsrfToken token) {
                token.getToken();
            }
            chain.doFilter(request, response);
        }
    }
}
