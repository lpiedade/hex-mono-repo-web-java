package com.example.app.portal;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * An unreachable API is a prompt, safe 503 with the envelope — never a hang and never an
 * upstream detail. Port 1 on loopback refuses connections, so no Docker is needed.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.autoconfigure.exclude=" + TestAutoConfigurationExclusions.VALUE,
        "app.bff.auth.mode=dev",
        "app.bff.auth.dev-token=unused",
        "app.bff.api-base-url=http://127.0.0.1:1",
        "app.bff.request-timeout=2s"
})
class BffUpstreamUnavailableTest {

    @Value("${local.server.port}")
    int port;

    @Test
    void anUnreachableApiIsA503ProblemWithTheEnvelope() throws Exception {
        HttpResponse<String> response = HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/app/bff/v1/items"))
                        .header("X-Correlation-ID", "down-1")
                        .build(),
                HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(503);
        assertThat(response.headers().firstValue("Content-Type")).hasValueSatisfying(
                type -> assertThat(type).startsWith("application/problem+json"));
        assertThat(response.headers().firstValue("X-Portal-Api-Version")).contains("1");
        assertThat(response.body())
                .contains("\"code\":\"UPSTREAM_UNAVAILABLE\"")
                .contains("\"correlationId\":\"down-1\"")
                .doesNotContain("127.0.0.1");
    }
}
