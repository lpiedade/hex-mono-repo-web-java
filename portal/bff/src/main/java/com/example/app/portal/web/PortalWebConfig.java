package com.example.app.portal.web;

import com.example.app.portal.config.PortalProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

/**
 * Registers the envelope filter at highest precedence — ahead of the security filter
 * chain — so every response, including a security refusal, carries it.
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
}
