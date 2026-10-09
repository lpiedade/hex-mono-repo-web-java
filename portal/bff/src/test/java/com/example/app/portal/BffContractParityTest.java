package com.example.app.portal;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.yaml.snakeyaml.Yaml;

/**
 * Keeps the two contracts honest with each other (ADR-012). Every operation
 * {@code portal-api-v1.yaml} proxies names its upstream in {@code x-proxies-to}; that
 * upstream must be declared in {@code openapi-v1.yaml}, and must be exactly the prefix
 * swap {@code BffProxy} performs. {@code ContractPathsAreServedTest} in {@code apps/api}
 * then holds the API contract to the controllers, so the chain browser → BFF → API is
 * checked end to end without booting anything.
 */
final class BffContractParityTest {

    private static final String BFF_PREFIX = "/bff/v1";
    private static final String API_PREFIX = "/api/v1";
    private static final Set<String> METHODS = Set.of("get", "put", "post", "delete", "patch", "head", "options");

    /** Relative to the {@code portal} module, the working directory of its tests. */
    private static final Path API_CONTRACT = Path.of("..", "apps", "api", "src", "main", "openapi", "openapi-v1.yaml");
    private static final Path PORTAL_CONTRACT = Path.of("bff", "src", "main", "openapi", "portal-api-v1.yaml");

    @Test
    void everyPortalOperationTargetsAnOperationTheApiDeclares() throws IOException {
        Set<String> upstream = operationsOf(load(API_CONTRACT));
        Map<String, String> portal = proxiedOperations(load(PORTAL_CONTRACT));

        assertThat(portal).as("the portal contract proxies nothing — the parser is broken").isNotEmpty();
        List<String> unserved = new ArrayList<>();
        portal.forEach((operation, target) -> {
            if (!upstream.contains(target)) {
                unserved.add(operation + "  ->  " + target);
            }
        });

        assertThat(unserved)
                .as("portal-api-v1.yaml proxies operations openapi-v1.yaml does not declare; each is a "
                        + "runtime 404")
                .isEmpty();
    }

    @Test
    void everyDeclaredUpstreamIsThePrefixSwapTheProxyPerforms() throws IOException {
        List<String> mismatched = new ArrayList<>();
        proxiedOperations(load(PORTAL_CONTRACT)).forEach((operation, target) -> {
            String[] declared = operation.split(" ", 2);
            String swapped = declared[0] + " " + declared[1].replaceFirst("^" + BFF_PREFIX, API_PREFIX);
            if (!swapped.equals(target)) {
                mismatched.add(operation + "  declares  " + target + "  but the proxy calls  " + swapped);
            }
        });

        assertThat(mismatched).as("x-proxies-to is documentation; the prefix swap is what runs").isEmpty();
    }

    /** {@code "GET /api/v1/items"} for every operation the API contract declares. */
    private static Set<String> operationsOf(Map<String, Object> document) {
        Set<String> operations = new LinkedHashSet<>();
        eachOperation(document, (path, method, operation) ->
                operations.add(method.toUpperCase(Locale.ROOT) + " " + API_PREFIX + path));
        return operations;
    }

    private static Map<String, String> proxiedOperations(Map<String, Object> document) {
        Map<String, String> proxied = new LinkedHashMap<>();
        eachOperation(document, (path, method, operation) -> {
            Object target = operation.get("x-proxies-to");
            if (target != null) {
                proxied.put(method.toUpperCase(Locale.ROOT) + " " + path, target.toString().trim());
            }
        });
        return proxied;
    }

    private interface OperationVisitor {
        void visit(String path, String method, Map<String, Object> operation);
    }

    @SuppressWarnings("unchecked")
    private static void eachOperation(Map<String, Object> document, OperationVisitor visitor) {
        Map<String, Object> paths = (Map<String, Object>) document.get("paths");
        paths.forEach((path, item) -> ((Map<String, Object>) item).forEach((key, value) -> {
            if (METHODS.contains(key)) {
                visitor.visit(path, key, (Map<String, Object>) value);
            }
        }));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> load(Path contract) throws IOException {
        Path path = contract.normalize();
        assertThat(Files.isReadable(path)).as("contract not found at %s", path.toAbsolutePath()).isTrue();
        try (InputStream in = Files.newInputStream(path)) {
            return (Map<String, Object>) new Yaml().load(in);
        }
    }
}
