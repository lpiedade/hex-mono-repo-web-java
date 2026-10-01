package com.example.app.portal.web;

import com.example.app.portal.config.PortalProperties;
import com.example.app.portal.security.UpstreamCredentials;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Enumeration;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Forwards a browser request under {@code /app/bff/v1/*} to the application API's
 * {@code /api/v1/*} (ADR-009). The controller stays thin; everything about forwarding
 * lives here.
 *
 * <ul>
 *   <li>Strips the prefix and forwards method, query, body and safe headers.</li>
 *   <li>Replaces any inbound {@code Authorization} with the token
 *       {@link UpstreamCredentials} supplies, so the browser never holds one; answers
 *       {@code 401 SESSION_REQUIRED} when a session-bound mode has none.</li>
 *   <li>Streams the API response back without buffering the whole body.</li>
 *   <li>Answers a safe 503 — never a hang or an upstream leak — when the API is
 *       unreachable or times out.</li>
 * </ul>
 */
@Component
public class BffProxy {

    private static final Logger log = LoggerFactory.getLogger(BffProxy.class);

    static final String BFF_PREFIX = "/app/bff/v1";
    static final String API_PREFIX = "/api/v1";

    /**
     * Request headers never forwarded: hop-by-hop headers, those the JDK client forbids
     * setting, and the browser's own credentials — the session cookie and the CSRF token
     * mean nothing to a stateless bearer API and must not reach it.
     */
    private static final Set<String> DROPPED_REQUEST_HEADERS = Set.of(
            "host", "connection", "content-length", "expect", "upgrade",
            "transfer-encoding", "te", "trailer", "keep-alive", "proxy-authorization",
            "accept-encoding", "cookie", "x-xsrf-token",
            "authorization", CorrelationId.HEADER.toLowerCase(Locale.ROOT));

    /** Response headers not copied back: hop-by-hop, recomputed, or owned by the BFF. */
    private static final Set<String> DROPPED_RESPONSE_HEADERS = Set.of(
            "connection", "keep-alive", "transfer-encoding", "te", "trailer",
            "upgrade", "content-length", "set-cookie", "proxy-authenticate",
            CorrelationId.HEADER.toLowerCase(Locale.ROOT),
            BffEnvelopeFilter.PORTAL_API_VERSION_HEADER.toLowerCase(Locale.ROOT));

    private static final Set<String> BODYLESS_METHODS = Set.of("GET", "HEAD", "OPTIONS", "TRACE", "DELETE");

    private final PortalProperties properties;
    private final UpstreamCredentials credentials;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public BffProxy(PortalProperties properties, UpstreamCredentials credentials, ObjectMapper objectMapper) {
        this.properties = properties;
        this.credentials = credentials;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(properties.requestTimeout())
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    public void forward(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String correlationId = CorrelationId.resolve(request);

        Optional<String> token = credentials.bearerToken(request, response);
        if (token.isEmpty() && credentials.sessionBound()) {
            BffProblem.sessionRequired(correlationId, properties.portalApiVersion()).writeTo(response, objectMapper);
            return;
        }

        HttpRequest upstreamRequest = buildUpstreamRequest(request, correlationId, token);
        HttpResponse<InputStream> upstreamResponse;
        long start = System.nanoTime();
        try {
            upstreamResponse = httpClient.send(upstreamRequest, HttpResponse.BodyHandlers.ofInputStream());
        } catch (IOException cause) {
            writeUpstreamUnavailable(request, response, correlationId, cause, start);
            return;
        } catch (InterruptedException cause) {
            Thread.currentThread().interrupt();
            writeUpstreamUnavailable(request, response, correlationId, cause, start);
            return;
        }
        copyUpstreamResponse(upstreamResponse, response);
    }

    private HttpRequest buildUpstreamRequest(HttpServletRequest request, String correlationId, Optional<String> token)
            throws IOException {
        HttpRequest.Builder builder = HttpRequest.newBuilder(upstreamUri(request))
                .timeout(properties.requestTimeout())
                .method(request.getMethod(), bodyPublisher(request));
        forwardRequestHeaders(request, builder);
        token.ifPresent(value -> builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + value));
        builder.header(CorrelationId.HEADER, correlationId);
        return builder.build();
    }

    private URI upstreamUri(HttpServletRequest request) {
        String path = request.getRequestURI().substring(BFF_PREFIX.length());
        String query = request.getQueryString();
        return URI.create(properties.normalizedApiBaseUrl() + API_PREFIX + path + (query != null ? "?" + query : ""));
    }

    private static HttpRequest.BodyPublisher bodyPublisher(HttpServletRequest request) throws IOException {
        if (BODYLESS_METHODS.contains(request.getMethod().toUpperCase(Locale.ROOT))) {
            return HttpRequest.BodyPublishers.noBody();
        }
        return HttpRequest.BodyPublishers.ofByteArray(request.getInputStream().readAllBytes());
    }

    private static void forwardRequestHeaders(HttpServletRequest request, HttpRequest.Builder builder) {
        Enumeration<String> names = request.getHeaderNames();
        while (names.hasMoreElements()) {
            String name = names.nextElement();
            if (DROPPED_REQUEST_HEADERS.contains(name.toLowerCase(Locale.ROOT))) {
                continue;
            }
            Enumeration<String> values = request.getHeaders(name);
            while (values.hasMoreElements()) {
                builder.header(name, values.nextElement());
            }
        }
    }

    private static void copyUpstreamResponse(HttpResponse<InputStream> upstream, HttpServletResponse response)
            throws IOException {
        response.setStatus(upstream.statusCode());
        // The API's own Problem Details bodies are forwarded verbatim; their correlation
        // id already matches, because the BFF forwarded this same X-Correlation-ID.
        upstream.headers().map().forEach((name, values) -> {
            if (DROPPED_RESPONSE_HEADERS.contains(name.toLowerCase(Locale.ROOT))) {
                return;
            }
            values.forEach(value -> response.addHeader(name, value));
        });
        // Authenticated data must not land in a shared or disk cache. The API's own
        // caching headers are authoritative when it sets them.
        if (!response.containsHeader(HttpHeaders.CACHE_CONTROL)) {
            response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        }
        try (InputStream body = upstream.body(); OutputStream out = response.getOutputStream()) {
            body.transferTo(out);
        }
    }

    /**
     * The API could not be reached or did not answer in time. The line says which call and
     * how long it waited, so a timeout reads differently from a refused connection.
     */
    private void writeUpstreamUnavailable(
            HttpServletRequest request, HttpServletResponse response, String correlationId, Exception cause,
            long start)
            throws IOException {
        long waitedMillis = (System.nanoTime() - start) / 1_000_000L;
        log.warn("Application API unreachable after {}ms: {} {} ({})",
                waitedMillis, request.getMethod(), request.getRequestURI(), cause.toString());
        BffProblem.upstreamUnavailable(correlationId, properties.portalApiVersion()).writeTo(response, objectMapper);
    }
}
