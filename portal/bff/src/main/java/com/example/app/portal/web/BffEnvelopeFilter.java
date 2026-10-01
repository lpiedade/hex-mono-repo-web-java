package com.example.app.portal.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.MDC;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Adds the BFF envelope to <em>every</em> response — proxied calls, health, about, and
 * BFF-generated problems alike — so the frontend can detect a contract-version mismatch
 * before parsing a body, and every request is traceable:
 *
 * <pre>
 * X-Portal-Api-Version: 1
 * X-Correlation-ID: &lt;propagated or generated UUID&gt;
 * </pre>
 *
 * <p>It also binds the correlation id into the MDC for the length of the request, so every
 * line the BFF logs while serving it carries the id (ADR-016).
 *
 * <p>Registered ahead of the security filter chain ({@link PortalWebConfig}), so even a
 * {@code 401 SESSION_REQUIRED} carries the envelope.
 */
public class BffEnvelopeFilter extends OncePerRequestFilter {

    public static final String PORTAL_API_VERSION_HEADER = "X-Portal-Api-Version";

    private final String portalApiVersion;

    public BffEnvelopeFilter(int portalApiVersion) {
        this.portalApiVersion = Integer.toString(portalApiVersion);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String correlationId = CorrelationId.fromHeaderOrRandom(request);
        request.setAttribute(CorrelationId.ATTRIBUTE, correlationId);
        response.setHeader(PORTAL_API_VERSION_HEADER, portalApiVersion);
        response.setHeader(CorrelationId.HEADER, correlationId);
        MDC.put(CorrelationId.MDC_KEY, correlationId);
        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove(CorrelationId.MDC_KEY);
        }
    }
}
