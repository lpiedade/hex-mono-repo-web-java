package com.example.app.api.web;

import com.example.app.api.config.CorsProperties;
import java.util.List;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Web-layer wiring that is independent of the authentication mode: the two servlet
 * filters outside the security chain, and the CORS policy inside it.
 *
 * <p>Filter order is part of the logging contract (ADR-016). {@link CorrelationIdFilter}
 * runs first, so everything after it logs under the request's id; {@link RequestLogFilter}
 * second; Spring Security's chain, which Boot registers at a lower precedence than both,
 * after them, so a request security refuses is still correlated and still logged.
 */
@Configuration(proxyBeanMethods = false)
public class WebConfig {

    private static final List<String> ALLOWED_HEADERS =
            List.of("Authorization", "Content-Type", "X-Correlation-ID");

    /** Response headers a browser may read cross-origin; an unexposed header is invisible to it. */
    private static final List<String> EXPOSED_HEADERS = List.of("Location", "ETag", "X-Correlation-ID");

    /**
     * Registers {@link CorrelationIdFilter} ahead of the Spring Security filter chain so a
     * correlation id exists when the security entry point renders a 401.
     */
    @Bean
    public FilterRegistrationBean<CorrelationIdFilter> correlationIdFilter() {
        FilterRegistrationBean<CorrelationIdFilter> registration =
                new FilterRegistrationBean<>(new CorrelationIdFilter());
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        registration.addUrlPatterns("/*");
        return registration;
    }

    /**
     * Registers {@link RequestLogFilter} right after the correlation filter, so every
     * access line carries the correlation id, and ahead of the security chain, so a
     * request security refuses is logged too.
     */
    @Bean
    public FilterRegistrationBean<RequestLogFilter> requestLogFilter() {
        FilterRegistrationBean<RequestLogFilter> registration = new FilterRegistrationBean<>(new RequestLogFilter());
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 1);
        registration.addUrlPatterns("/*");
        return registration;
    }

    /**
     * CORS policy for the security filter chain. With no origin configured the source
     * has no mappings, so Spring adds no CORS headers — CORS is off by default.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource(CorsProperties corsProperties) {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        if (!corsProperties.isEnabled()) {
            return source;
        }
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(corsProperties.allowedOrigins());
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(ALLOWED_HEADERS);
        configuration.setExposedHeaders(EXPOSED_HEADERS);
        configuration.setAllowCredentials(corsProperties.allowCredentials());
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
