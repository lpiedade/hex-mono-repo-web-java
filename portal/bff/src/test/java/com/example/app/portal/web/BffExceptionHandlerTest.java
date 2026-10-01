package com.example.app.portal.web;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.spi.ILoggingEvent;
import com.example.app.portal.LogCapture;
import com.example.app.portal.TestAutoConfigurationExclusions;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Every failure the BFF answers itself is a {@link BffProblem} with the envelope, and the
 * unexpected one is logged with its cause; every request but the health probe leaves an
 * access line. No API is needed: nothing here is proxied.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.autoconfigure.exclude=" + TestAutoConfigurationExclusions.VALUE,
        "app.bff.auth.mode=dev",
        "app.bff.auth.dev-token=unused"
})
class BffExceptionHandlerTest {

    /** A handler that fails the way a defect in the BFF would. */
    @RestController
    static class Failing {
        @GetMapping("/app/test/boom")
        String boom() {
            throw new IllegalStateException("defect under test");
        }
    }

    @TestConfiguration
    static class FailingRoute {
        @Bean
        Failing failing() {
            return new Failing();
        }
    }

    @Value("${local.server.port}")
    int port;

    private final HttpClient http = HttpClient.newHttpClient();

    @Test
    void anUnexpectedFailureIsAnInternalProblemAndLoggedWithItsCause() throws Exception {
        try (LogCapture errors = LogCapture.of(BffExceptionHandler.class)) {
            HttpResponse<String> response = get("GET", "/app/test/boom", "X-Correlation-ID", "boom-1");

            assertProblem(response, 500, "INTERNAL_ERROR");
            assertThat(response.body()).contains("\"correlationId\":\"boom-1\"").doesNotContain("defect under test");
            assertThat(errors.events()).singleElement().satisfies(event -> {
                assertThat(event.getLevel()).isEqualTo(Level.ERROR);
                assertThat(event.getThrowableProxy().getMessage()).isEqualTo("defect under test");
                assertThat(event.getMDCPropertyMap()).containsEntry("correlationId", "boom-1");
            });
        }
    }

    @Test
    void anUnmappedPathIsTheBffsOwnNotFound() throws Exception {
        assertProblem(get("GET", "/app/nothing-here"), 404, "NOT_FOUND");
    }

    @Test
    void aStatusTheFrameworkDecidedKeepsItInTheBffsShape() throws Exception {
        assertProblem(get("POST", "/app/about"), 405, "METHOD_NOT_ALLOWED");
    }

    @Test
    void everyRequestButTheHealthProbeLeavesAnAccessLine() throws Exception {
        try (LogCapture access = LogCapture.of(BffRequestLogFilter.LOGGER)) {
            get("GET", "/app/about?who=secret");
            get("GET", "/app/health");

            assertThat(access.events()).extracting(ILoggingEvent::getFormattedMessage)
                    .singleElement(org.assertj.core.api.InstanceOfAssertFactories.STRING)
                    .matches("GET /app/about 200 \\d+ms");
        }
    }

    private HttpResponse<String> get(String method, String path, String... headers) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .method(method, HttpRequest.BodyPublishers.noBody());
        for (int i = 0; i < headers.length; i += 2) {
            request.header(headers[i], headers[i + 1]);
        }
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private static void assertProblem(HttpResponse<String> response, int status, String code) {
        assertThat(response.statusCode()).isEqualTo(status);
        assertThat(response.headers().firstValue("Content-Type"))
                .hasValueSatisfying(type -> assertThat(type).startsWith("application/problem+json"));
        assertThat(response.headers().firstValue("X-Portal-Api-Version")).contains("1");
        assertThat(response.body()).contains("\"code\":\"" + code + "\"").contains("\"portalApiVersion\":1");
    }
}
