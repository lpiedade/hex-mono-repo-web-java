package com.example.app.api.web;

import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;

/**
 * Per-request correlation identifier support. The BFF forwards an
 * {@code X-Correlation-ID}; when absent the API generates one. The same value is
 * echoed on the response header and embedded in every Problem Details body so a
 * client can tie an error to server-side logs.
 */
public final class CorrelationId {

    /** Correlation header exchanged with the BFF. */
    public static final String HEADER = "X-Correlation-ID";

    /** Request attribute under which {@link CorrelationIdFilter} stores the resolved id. */
    public static final String ATTRIBUTE = CorrelationId.class.getName() + ".value";

    /**
     * MDC key under which the resolved id is bound for the duration of the request.
     *
     * <p>The log pattern in {@code logback-spring.xml} prints {@code %X{correlationId}}, so
     * this name is part of the log format and not merely internal (ADR-016).
     */
    public static final String MDC_KEY = "correlationId";

    private CorrelationId() {
    }

    /**
     * Returns the correlation id already resolved for this request, falling back to the
     * inbound header, and finally to a freshly generated UUID. Never null or blank.
     */
    public static String resolve(HttpServletRequest request) {
        Object stored = request.getAttribute(ATTRIBUTE);
        if (stored instanceof String value && !value.isBlank()) {
            return value;
        }
        return fromHeaderOrRandom(request);
    }

    /** The inbound {@link #HEADER} value, or a freshly generated UUID when absent or blank. */
    public static String fromHeaderOrRandom(HttpServletRequest request) {
        String header = request.getHeader(HEADER);
        if (header != null && !header.isBlank()) {
            return header.trim();
        }
        return UUID.randomUUID().toString();
    }
}
