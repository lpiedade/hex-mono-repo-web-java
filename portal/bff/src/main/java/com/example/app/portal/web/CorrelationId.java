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

    /** The header the id travels in, from the browser, to the API, and back on the response. */
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

    /**
     * The id {@link BffEnvelopeFilter} resolved for this request, falling back to the
     * inbound header, and finally to a freshly generated UUID. Never null or blank.
     */
    public static String resolve(HttpServletRequest request) {
        Object stored = request.getAttribute(ATTRIBUTE);
        if (stored instanceof String value && !value.isBlank()) {
            return value;
        }
        return fromHeaderOrRandom(request);
    }

    /** The inbound {@link #HEADER} value, trimmed, or a freshly generated UUID when absent or blank. */
    public static String fromHeaderOrRandom(HttpServletRequest request) {
        String header = request.getHeader(HEADER);
        if (header != null && !header.isBlank()) {
            return header.trim();
        }
        return UUID.randomUUID().toString();
    }
}
