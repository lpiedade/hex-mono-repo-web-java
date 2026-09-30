package com.example.app.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

/**
 * The shipped development dataset loads into a real API (infra/test-fixtures/README.md):
 * every entry is a request the contract and the domain accept. A fixture the API would
 * refuse fails here, not on a developer's first run of {@code seed-dev-data.sh}.
 */
class DevDataFixtureIT extends ApiIntegrationTest {

    private static final Path ITEMS =
            Path.of("..", "..", "infra", "test-fixtures", "dev-data", "items.json").normalize();

    @Test
    void everyItemInTheDatasetIsAccepted() throws Exception {
        JsonNode items = json(Files.readString(ITEMS));
        assertThat(items.isArray() && !items.isEmpty()).as("%s holds a non-empty array", ITEMS).isTrue();

        for (JsonNode item : items) {
            HttpResponse<String> response =
                    send("POST", "/api/v1/items", item.toString(), "Authorization", bearer());
            assertThat(response.statusCode()).as("POST %s: %s", item, response.body()).isEqualTo(201);
        }
    }
}
