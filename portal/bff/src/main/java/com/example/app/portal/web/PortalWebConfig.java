package com.example.app.portal.web;

import com.example.app.portal.config.PortalProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

/**
 * Registers the BFF's two servlet filters ahead of the security filter chain: the envelope
 * filter at highest precedence, so every response, including a security refusal, carries
 * it and every line logs under the correlation id; and the access-log filter right after
 * it, so a request security refuses is logged too.
 *
 * <p>The BFF serves no static assets: the SPA is hosted separately (ADR-017).
 */
@Configuration(proxyBeanMethods = false)
public class PortalWebConfig {

    @Bean
    public FilterRegistrationBean<BffEnvelopeFilter> bffEnvelopeFilter(PortalProperties properties) {
        FilterRegistrationBean<BffEnvelopeFilter> registration =
                new FilterRegistrationBean<>(new BffEnvelopeFilter(properties.portalApiVersion()));
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        registration.addUrlPatterns("/*");
        return registration;
    }

    /** Right after the envelope filter, so every access line carries the correlation id. */
    @Bean
    public FilterRegistrationBean<BffRequestLogFilter> bffRequestLogFilter() {
        FilterRegistrationBean<BffRequestLogFilter> registration =
                new FilterRegistrationBean<>(new BffRequestLogFilter());
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 1);
        registration.addUrlPatterns("/*");
        return registration;
    }
}
