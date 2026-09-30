package com.example.app.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

/**
 * What every deployment of the API promises regardless of its resources: public health
 * probes that disclose nothing, the served contract, authentication on everything else,
 * correlation ids, and the caller's identity.
 */
class PlatformIT extends ApiIntegrationTest {

    @Test
    void healthProbesArePublicAndDiscloseNothing() throws Exception {
        for (String path : new String[] {"/actuator/health", "/actuator/health/liveness", "/actuator/health/readiness"}) {
            HttpResponse<String> response = get(path);
            assertThat(response.statusCode()).as(path).isEqualTo(200);
            JsonNode body = json(response.body());
            assertThat(body.get("status").asString()).as(path).isEqualTo("UP");
            assertThat(body.has("components")).as(path).isFalse();
            assertThat(body.has("details")).as(path).isFalse();
        }
    }

    @Test
    void onlyHealthIsExposedFromActuator() throws Exception {
        assertThat(get("/actuator/env").statusCode()).isIn(401, 404);
        assertThat(get("/actuator/env", "Authorization", bearer()).statusCode()).isEqualTo(404);
    }

    @Test
    void theContractIsServedInBothRepresentations() throws Exception {
        HttpResponse<String> yaml = get("/v3/api-docs.yaml");
        assertThat(yaml.statusCode()).isEqualTo(200);
        assertThat(yaml.body()).startsWith("openapi: 3.1.0");

        HttpResponse<String> json = get("/v3/api-docs");
        assertThat(json.statusCode()).isEqualTo(200);
        assertThat(json(json.body()).get("paths").has("/items")).isTrue();
    }

    @Test
    void swaggerUiIsDevProfileOnly() throws Exception {
        assertThat(get("/swagger-ui.html").statusCode()).isIn(401, 404);
    }

    @Test
    void everyApiPathRequiresAToken() throws Exception {
        assertProblem(get("/api/v1/items"), 401, "UNAUTHENTICATED");
        assertProblem(get("/api/v1/items", "Authorization", "Bearer wrong"), 401, "UNAUTHENTICATED");
        assertProblem(get("/api/v1/nothing-here"), 401, "UNAUTHENTICATED");
    }

    @Test
    void anUnmappedPathIsAProblemNotAWhitelabelPage() throws Exception {
        assertProblem(get("/api/v1/nothing-here", "Authorization", bearer()), 404, "NOT_FOUND");
    }

    @Test
    void theCorrelationIdIsPropagatedOrMinted() throws Exception {
        HttpResponse<String> echoed = get("/api/v1/items", "Authorization", bearer(), "X-Correlation-ID", "abc-123");
        assertThat(echoed.headers().firstValue("X-Correlation-ID")).contains("abc-123");

        HttpResponse<String> refused = get("/api/v1/items", "X-Correlation-ID", "def-456");
        assertThat(json(refused.body()).get("correlationId").asString()).isEqualTo("def-456");

        assertThat(get("/api/v1/items", "Authorization", bearer()).headers().firstValue("X-Correlation-ID"))
                .hasValueSatisfying(id -> assertThat(id).isNotBlank());
    }

    @Test
    void theDevTokenCallerHoldsEveryRole() throws Exception {
        JsonNode context = json(get("/api/v1/user-context", "Authorization", bearer()).body());

        assertThat(context.get("subject").asString()).isEqualTo("dev@app.local");
        assertThat(context.get("roles").toString()).isEqualTo("[\"READER\",\"EDITOR\",\"ADMIN\"]");
    }

    @Test
    void aboutReportsBuildCoordinates() throws Exception {
        JsonNode about = json(get("/api/v1/about", "Authorization", bearer()).body());

        assertThat(about.get("build").get("version").asString()).isNotBlank();
        assertThat(about.get("build").get("commit").asString()).isNotBlank();
    }
}
