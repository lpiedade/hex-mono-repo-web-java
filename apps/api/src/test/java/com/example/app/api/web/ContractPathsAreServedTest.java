package com.example.app.api.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Guards the invariant the served contract cannot state about itself: that every path
 * {@code openapi-v1.yaml} declares is a path a controller actually maps. The contract is
 * served by the API and is the source of every generated client, so a declared path with
 * no controller is a promise the framework answers with a bare 404.
 *
 * <p>Mappings are read by scanning for {@code @RestController} and merging class- and
 * method-level annotations, rather than by booting the application, so this is a unit
 * test that needs no Docker and fails on the pull request that introduces the drift.
 *
 * <p>Direction is deliberate: contract ⊆ code. A path served but undeclared is a
 * different defect, and some are development-only by design (the dev Swagger UI).
 */
final class ContractPathsAreServedTest {

    private static final String API_PREFIX = "/api/v1";
    private static final String CONTROLLER_PACKAGE = "com.example.app.api";
    private static final Pattern PATH_VARIABLE = Pattern.compile("\\{[^}]*}");

    @Test
    void everyDeclaredPathIsMappedByAController() throws IOException {
        Set<String> served = servedPaths();

        List<String> unserved = new ArrayList<>();
        for (String declared : ContractDocument.declaredPaths()) {
            if (!served.contains(normalise(declared))) {
                unserved.add(declared);
            }
        }

        assertThat(unserved)
                .as("openapi-v1.yaml declares paths no @RestController maps. Implement them, or "
                        + "remove them until they exist")
                .isEmpty();
    }

    private static Set<String> servedPaths() {
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(RestController.class));

        Set<String> served = new LinkedHashSet<>();
        for (BeanDefinition definition : scanner.findCandidateComponents(CONTROLLER_PACKAGE)) {
            Class<?> controller = load(definition.getBeanClassName());
            for (String prefix : prefixesOf(controller)) {
                for (Method method : controller.getDeclaredMethods()) {
                    RequestMapping mapping = AnnotatedElementUtils.findMergedAnnotation(method, RequestMapping.class);
                    if (mapping == null) {
                        continue;
                    }
                    List<String> suffixes = patternsOf(mapping);
                    for (String suffix : suffixes.isEmpty() ? List.of("") : suffixes) {
                        served.add(normalise(strip(prefix + suffix)));
                    }
                }
            }
        }

        assertThat(served).as("no controller mappings were found at all — the scan is broken").isNotEmpty();
        return served;
    }

    private static List<String> prefixesOf(Class<?> controller) {
        RequestMapping mapping = AnnotatedElementUtils.findMergedAnnotation(controller, RequestMapping.class);
        if (mapping == null) {
            return List.of("");
        }
        List<String> patterns = patternsOf(mapping);
        return patterns.isEmpty() ? List.of("") : patterns;
    }

    private static List<String> patternsOf(RequestMapping mapping) {
        return List.of(mapping.path().length > 0 ? mapping.path() : mapping.value());
    }

    private static String strip(String path) {
        return path.startsWith(API_PREFIX) ? path.substring(API_PREFIX.length()) : path;
    }

    /** Path-variable names are the caller's choice, not the contract's. */
    private static String normalise(String path) {
        String normalised = PATH_VARIABLE.matcher(path).replaceAll("{}");
        return normalised.length() > 1 && normalised.endsWith("/")
                ? normalised.substring(0, normalised.length() - 1)
                : normalised;
    }

    private static Class<?> load(String className) {
        try {
            return Class.forName(className);
        } catch (ClassNotFoundException e) {
            throw new IllegalStateException("scanned but could not load " + className, e);
        }
    }
}
