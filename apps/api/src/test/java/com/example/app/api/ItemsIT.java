package com.example.app.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.http.HttpResponse;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

/** The example resource end to end over HTTP: contract shape, status codes, problems. */
class ItemsIT extends ApiIntegrationTest {

    @Test
    void createReadUpdateDelete() throws Exception {
        String name = unique("Widget");

        HttpResponse<String> created = send("POST", "/api/v1/items",
                "{\"name\":\"" + name + "\",\"description\":\"A thing\"}", "Authorization", bearer());
        assertThat(created.statusCode()).isEqualTo(201);
        JsonNode item = json(created.body());
        String id = item.get("id").asString();
        assertThat(created.headers().firstValue("Location")).contains("/api/v1/items/" + id);
        assertThat(created.body()).startsWith("{\"schemaVersion\":1");
        assertThat(item.get("name").asString()).isEqualTo(name);
        assertThat(item.get("createdAt").asString()).isEqualTo(item.get("updatedAt").asString());

        HttpResponse<String> read = get("/api/v1/items/" + id, "Authorization", bearer());
        assertThat(read.statusCode()).isEqualTo(200);
        assertThat(json(read.body()).get("description").asString()).isEqualTo("A thing");

        String renamed = unique("Gadget");
        HttpResponse<String> updated = send("PUT", "/api/v1/items/" + id,
                "{\"name\":\"" + renamed + "\"}", "Authorization", bearer());
        assertThat(updated.statusCode()).isEqualTo(200);
        assertThat(json(updated.body()).get("name").asString()).isEqualTo(renamed);
        assertThat(json(updated.body()).has("description")).isFalse();

        HttpResponse<String> listed = get("/api/v1/items", "Authorization", bearer());
        assertThat(listed.statusCode()).isEqualTo(200);
        assertThat(listed.body()).contains(renamed);

        assertThat(send("DELETE", "/api/v1/items/" + id, null, "Authorization", bearer()).statusCode())
                .isEqualTo(204);
        assertProblem(get("/api/v1/items/" + id, "Authorization", bearer()), 404, "ITEM_NOT_FOUND");
    }

    @Test
    void aDuplicateNameIsAConflict() throws Exception {
        String body = "{\"name\":\"" + unique("Twin") + "\"}";
        assertThat(send("POST", "/api/v1/items", body, "Authorization", bearer()).statusCode()).isEqualTo(201);

        assertProblem(send("POST", "/api/v1/items", body, "Authorization", bearer()), 409, "ITEM_NAME_EXISTS");
    }

    @Test
    void aBodyOutsideTheContractIsABadRequestNamingTheField() throws Exception {
        HttpResponse<String> response = send("POST", "/api/v1/items",
                "{\"name\":\"" + "n".repeat(121) + "\"}", "Authorization", bearer());

        assertProblem(response, 400, "BAD_REQUEST");
        assertThat(json(response.body()).get("errors").get(0).get("field").asString()).isEqualTo("name");
    }

    @Test
    void aBlankNamePassesTheContractButNotTheDomain() throws Exception {
        assertProblem(send("POST", "/api/v1/items", "{\"name\":\"   \"}", "Authorization", bearer()),
                422, "ITEM_INVALID");
    }

    @Test
    void malformedRequestsAreBadRequests() throws Exception {
        assertProblem(get("/api/v1/items/not-a-uuid", "Authorization", bearer()), 400, "BAD_REQUEST");
        assertProblem(send("POST", "/api/v1/items", "{not json", "Authorization", bearer()), 400, "BAD_REQUEST");
    }

    @Test
    void unknownIdsAreNotFound() throws Exception {
        String path = "/api/v1/items/" + UUID.randomUUID();
        assertProblem(send("PUT", path, "{\"name\":\"x\"}", "Authorization", bearer()), 404, "ITEM_NOT_FOUND");
        assertProblem(send("DELETE", path, null, "Authorization", bearer()), 404, "ITEM_NOT_FOUND");
    }

    @Test
    void anUnsupportedMethodKeepsItsStatus() throws Exception {
        assertProblem(send("PATCH", "/api/v1/items", "{}", "Authorization", bearer()),
                405, "METHOD_NOT_ALLOWED");
    }

    private static String unique(String prefix) {
        return prefix + "-" + UUID.randomUUID();
    }
}
