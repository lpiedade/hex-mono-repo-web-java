package com.example.app.portal.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * One access line per request — method, path, status and duration — on the logger
 * {@value #LOGGER} (ADR-016). The BFF is where the browser's whole round trip is timed:
 * for a proxied call the duration includes the API's, whose own access line carries the
 * same correlation id.
 *
 * <p>The query string is left out (it is what a client typed), and so is the health probe,
 * which an orchestrator polls every few seconds. Registered right after the envelope
 * filter, which binds the correlation id, and ahead of the security chain, so a request
 * security refuses is logged too.
 */
public class BffRequestLogFilter extends OncePerRequestFilter {

    /** The access logger's name; {@code logging.level.com.example.app.portal.access} tunes it. */
    public static final String LOGGER = "com.example.app.portal.access";

    private static final Logger log = LoggerFactory.getLogger(LOGGER);

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return request.getRequestURI().equals("/app/health");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        long start = System.nanoTime();
        try {
            filterChain.doFilter(request, response);
        } finally {
            long elapsedMillis = (System.nanoTime() - start) / 1_000_000L;
            log.info("{} {} {} {}ms",
                    request.getMethod(), request.getRequestURI(), response.getStatus(), elapsedMillis);
        }
    }
}
