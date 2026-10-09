package com.example.app.api.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.yaml.snakeyaml.Yaml;

/**
 * Reads {@code openapi-v1.yaml} for the tests that assert something about the
 * contract's own shape, so they parse the document once, the same way.
 */
final class ContractDocument {

    private ContractDocument() {}

    /** Every {@code paths} key of the contract, {@code /api/v1} prefix excluded. */
    @SuppressWarnings("unchecked")
    static List<String> declaredPaths() throws IOException {
        Path contract = Path.of("src", "main", "openapi", "openapi-v1.yaml");
        assertThat(Files.isReadable(contract))
                .as("contract not found at %s", contract.toAbsolutePath())
                .isTrue();

        try (InputStream in = Files.newInputStream(contract)) {
            Map<String, Object> document = (Map<String, Object>) new Yaml().load(in);
            Map<String, Object> paths = (Map<String, Object>) document.get("paths");
            return new ArrayList<>(paths.keySet());
        }
    }
}
