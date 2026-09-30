package com.example.app.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Base for application-API HTTP integration tests (ADR-006). It boots the real
 * application on a random port in {@code dev-token} mode against a real PostgreSQL
 * Testcontainer migrated by Flyway, and drives it over loopback HTTP.
 *
 * <p>The dev token is generated per run and injected as a property, so no token value is
 * ever committed.
 *
 * <p>One container for every suite that extends this class: it is started once and never
 * stopped between classes, so the cached Spring context's datasource stays valid across
 * the suite (a per-class {@code @Container} would be torn down while the shared context
 * still pointed at it). Ryuk reaps it at JVM exit. A suite that adds its own
 * {@code @DynamicPropertySource} costs a second Spring context; one that only extends
 * this class does not.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "app.auth.mode=dev-token")
@Testcontainers(disabledWithoutDocker = true)
public abstract class ApiIntegrationTest {

    protected static final String DEV_TOKEN = UUID.randomUUID().toString();

    protected static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17-alpine");

    static {
        if (DockerClientFactory.instance().isDockerAvailable()) {
            POSTGRES.start();
        }
    }

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("app.auth.dev-token", () -> DEV_TOKEN);
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Value("${local.server.port}")
    protected int port;

    @Autowired
    protected ObjectMapper objectMapper;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    protected URI url(String path) {
        return URI.create("http://localhost:" + port + path);
    }

    protected HttpResponse<String> get(String path, String... headers) throws Exception {
        return send("GET", path, null, headers);
    }

    protected HttpResponse<String> send(String method, String path, String body, String... headers)
            throws Exception {
        HttpRequest.BodyPublisher publisher = body == null
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(body);
        HttpRequest.Builder builder = HttpRequest.newBuilder(url(path)).method(method, publisher);
        if (body != null) {
            builder.header("Content-Type", "application/json");
        }
        for (int i = 0; i < headers.length; i += 2) {
            builder.header(headers[i], headers[i + 1]);
        }
        return httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    protected JsonNode json(String body) {
        return objectMapper.readTree(body);
    }

    protected static String bearer() {
        return "Bearer " + DEV_TOKEN;
    }

    /**
     * Asserts a controlled HTTP error: the status, the stable {@code code} a client
     * branches on, and no internal detail in the body.
     */
    protected void assertProblem(HttpResponse<String> response, int status, String code) {
        assertThat(response.statusCode()).isEqualTo(status);
        assertThat(response.headers().firstValue("Content-Type")).hasValueSatisfying(
                type -> assertThat(type).startsWith("application/problem+json"));
        JsonNode body = json(response.body());
        assertThat(body.get("code").asString()).isEqualTo(code);
        assertThat(body.get("status").asInt()).isEqualTo(status);
        assertThat(body.get("correlationId").asString()).isNotBlank();
        assertThatContainsNoInternalLeak(response.body());
    }

    protected static void assertThatContainsNoInternalLeak(String body) {
        assertThat(body.toLowerCase())
                .doesNotContain("exception")
                .doesNotContain("\tat ")
                .doesNotContain("at com.example.app")
                .doesNotContain("select ")
                .doesNotContain("jdbc")
                .doesNotContain("password");
    }
}
