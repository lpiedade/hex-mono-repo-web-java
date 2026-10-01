package com.example.app.api.web;

import com.example.app.api.security.SubjectMdcFilter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * One access line per request — method, path, status and duration — on the logger
 * {@value #LOGGER}, so its level can be set apart from the application's (ADR-016).
 * Errors alone say nothing about the traffic that did not fail.
 *
 * <p>The line carries the correlation id and, once security has bound it, the subject
 * (see {@link SubjectMdcFilter}). The query string is left out: it is the part of a URL
 * most likely to carry data a client typed. Health probes are skipped, because an
 * orchestrator polls them every few seconds and they would drown everything else.
 *
 * <p>Registered right after {@link CorrelationIdFilter} and ahead of the security
 * chain ({@link WebConfig}), so a request refused by security is logged too. It is also
 * where the subject is unbound: the security chain inside it has finished by the time
 * its line is written, and that line is the last one that needs the subject.
 */
public class RequestLogFilter extends OncePerRequestFilter {

    /** The access logger's name; {@code logging.level.com.example.app.api.access} tunes it. */
    public static final String LOGGER = "com.example.app.api.access";

    private static final Logger log = LoggerFactory.getLogger(LOGGER);

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return request.getRequestURI().startsWith("/actuator/health");
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
            MDC.remove(SubjectMdcFilter.MDC_KEY);
        }
    }
}
