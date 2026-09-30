package com.example.app.portal.web;

import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;

/**
 * Per-request correlation identifier support for the BFF. The browser may send an
 * {@code X-Correlation-ID}; when absent the BFF generates one. The same value is echoed
 * on the response, forwarded to the application API, and embedded in the BFF's own
 * problem bodies, so a request can be traced end to end.
 */
public final class CorrelationId {

    public static final String HEADER = "X-Correlation-ID";

    /** Request attribute under which {@link BffEnvelopeFilter} stores the resolved id. */
    public static final String ATTRIBUTE = CorrelationId.class.getName() + ".value";

    /**
     * MDC key printed by {@code logback-spring.xml} (ADR-016). It matches the API's key
     * deliberately, so one query joins a BFF line to the API line it provoked.
     */
    public static final String MDC_KEY = "correlationId";

    private CorrelationId() {
    }

    public static String resolve(HttpServletRequest request) {
        Object stored = request.getAttribute(ATTRIBUTE);
        if (stored instanceof String value && !value.isBlank()) {
            return value;
        }
        return fromHeaderOrRandom(request);
    }

    public static String fromHeaderOrRandom(HttpServletRequest request) {
        String header = request.getHeader(HEADER);
        if (header != null && !header.isBlank()) {
            return header.trim();
        }
        return UUID.randomUUID().toString();
    }
}
