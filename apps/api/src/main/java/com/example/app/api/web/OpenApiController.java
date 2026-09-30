package com.example.app.api.web;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.dataformat.yaml.YAMLMapper;

/**
 * Serves the authoritative OpenAPI contract. The published document is
 * {@code docs/arch/api-layer/openapi-v1.yaml} — the same file the response models are
 * generated from (ADR-012) — copied onto the classpath by the build, so the served bytes
 * and the generated models never drift. springdoc is deliberately not used: the
 * contract is authored, not derived from controllers.
 *
 * <p>Both representations are public in every profile so the document remains
 * available for automated contract validation. Swagger UI, by contrast, is dev-profile
 * only ({@link SwaggerUiDevConfig}).
 */
@RestController
public class OpenApiController {

    private static final String CONTRACT_RESOURCE = "openapi/openapi-v1.yaml";
    private static final MediaType YAML = MediaType.parseMediaType("application/yaml");

    private final byte[] yaml;
    private final byte[] json;

    public OpenApiController() {
        this.yaml = readContract();
        this.json = toJson(this.yaml);
    }

    @GetMapping(value = "/v3/api-docs.yaml", produces = "application/yaml")
    public ResponseEntity<byte[]> yaml() {
        return ResponseEntity.ok().contentType(YAML).body(yaml);
    }

    @GetMapping(value = "/v3/api-docs", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<byte[]> json() {
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(json);
    }

    private static byte[] readContract() {
        ClassPathResource resource = new ClassPathResource(CONTRACT_RESOURCE);
        try (InputStream in = resource.getInputStream()) {
            return in.readAllBytes();
        } catch (IOException e) {
            // The build copies the contract onto the classpath; its absence is a
            // packaging error that should fail fast at startup.
            throw new UncheckedIOException(
                    "OpenAPI contract not found on the classpath at " + CONTRACT_RESOURCE, e);
        }
    }

    private static byte[] toJson(byte[] yamlBytes) {
        JsonNode tree = YAMLMapper.builder().build().readTree(yamlBytes);
        return JsonMapper.builder().build().writeValueAsString(tree).getBytes(StandardCharsets.UTF_8);
    }
}
