package com.example.app.portal;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.app.api.AppApiApplication;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Real-service BFF integration test (ADR-014): boots the real application API in-process
 * against a PostgreSQL Testcontainer and drives the BFF in front of it over loopback HTTP,
 * in {@code dev} mode. It proves the proxy against the real service rather than a mock:
 * the browser reaches the API through the BFF without ever holding a token, and every
 * response carries the envelope.
 *
 * <p>The co-booted API does not read {@code apps/api}'s {@code application.yml}: Spring
 * resolves {@code classpath:application.yml} to one resource and the BFF's comes first.
 * Everything the API needs here is therefore passed as a property.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "spring.autoconfigure.exclude=" + TestAutoConfigurationExclusions.VALUE)
@Testcontainers(disabledWithoutDocker = true)
class PortalBffIT {

    private static final String DEV_TOKEN = UUID.randomUUID().toString();

    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17-alpine");

    private static ConfigurableApplicationContext api;

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("app.bff.auth.mode", () -> "dev");
        registry.add("app.bff.auth.dev-token", () -> DEV_TOKEN);
        registry.add("app.bff.api-base-url", () -> "http://localhost:" + apiPort());
    }

    /** Starts the API on first use, once Docker is known to be there. */
    private static synchronized int apiPort() {
        if (api == null && DockerClientFactory.instance().isDockerAvailable()) {
            POSTGRES.start();
            api = new SpringApplicationBuilder(AppApiApplication.class).properties(
                            "server.port=0",
                            "server.address=127.0.0.1",
                            "spring.datasource.url=" + POSTGRES.getJdbcUrl(),
                            "spring.datasource.username=" + POSTGRES.getUsername(),
                            "spring.datasource.password=" + POSTGRES.getPassword(),
                            "app.auth.mode=dev-token",
                            "app.auth.dev-token=" + DEV_TOKEN)
                    .run();
        }
        return api == null ? 1 : api.getEnvironment().getRequiredProperty("local.server.port", Integer.class);
    }

    @AfterAll
    static void stopApi() {
        if (api != null) {
            api.close();
        }
    }

    @Value("${local.server.port}")
    int port;

    private final HttpClient http = HttpClient.newHttpClient();

    @Test
    void theBrowserReachesTheApiThroughTheBffWithoutAToken() throws Exception {
        String name = "Via BFF " + UUID.randomUUID();

        HttpResponse<String> created = send("POST", "/app/bff/v1/items", "{\"name\":\"" + name + "\"}");
        assertThat(created.statusCode()).isEqualTo(201);
        assertThat(created.body()).contains(name);

        HttpResponse<String> listed = send("GET", "/app/bff/v1/items", null);
        assertThat(listed.statusCode()).isEqualTo(200);
        assertThat(listed.body()).contains(name);
        assertThat(listed.headers().firstValue("Cache-Control"))
                .hasValueSatisfying(value -> assertThat(value).contains("no-store"));
    }

    @Test
    void everyResponseCarriesTheEnvelope() throws Exception {
        HttpResponse<String> response = send("GET", "/app/bff/v1/user-context", null, "X-Correlation-ID", "trace-me");

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).contains("\"subject\"");
        assertThat(response.headers().firstValue("X-Portal-Api-Version")).contains("1");
        assertThat(response.headers().firstValue("X-Correlation-ID")).contains("trace-me");
    }

    @Test
    void theApisProblemBodiesArePropagatedUnchanged() throws Exception {
        HttpResponse<String> response = send("GET", "/app/bff/v1/items/" + UUID.randomUUID(), null,
                "X-Correlation-ID", "same-id");

        assertThat(response.statusCode()).isEqualTo(404);
        assertThat(response.body()).contains("\"code\":\"ITEM_NOT_FOUND\"").contains("\"correlationId\":\"same-id\"");
    }

    @Test
    void theBrowsersOwnCredentialsNeverReachTheApi() throws Exception {
        // A forged bearer token is replaced, not forwarded: the dev token still authenticates.
        HttpResponse<String> response = send("GET", "/app/bff/v1/items", null,
                "Authorization", "Bearer forged", "Cookie", "JSESSIONID=abc");

        assertThat(response.statusCode()).isEqualTo(200);
    }

    @Test
    void healthAboutAndLogoutAreTheBffsOwn() throws Exception {
        assertThat(send("GET", "/app/health", null).body()).isEqualTo("{\"status\":\"UP\"}");
        assertThat(send("GET", "/app/about", null).body()).contains("\"portalApiVersion\":1");
        assertThat(send("POST", "/app/bff/logout", null).statusCode()).isEqualTo(204);
    }

    private HttpResponse<String> send(String method, String path, String body, String... headers) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .method(method, body == null
                        ? HttpRequest.BodyPublishers.noBody()
                        : HttpRequest.BodyPublishers.ofString(body));
        if (body != null) {
            request.header("Content-Type", "application/json");
        }
        for (int i = 0; i < headers.length; i += 2) {
            request.header(headers[i], headers[i + 1]);
        }
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }
}
