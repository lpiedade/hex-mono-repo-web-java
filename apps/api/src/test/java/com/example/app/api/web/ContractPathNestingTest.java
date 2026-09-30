package com.example.app.api.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

/**
 * Enforces the countable clause of ADR-020: a declared path nests at most three
 * sub-resource levels below its root collection.
 *
 * <p>The other clauses — which resource is top-level, which is a nested singleton, and
 * that no resource gets a second canonical URL — are judgement and belong to review.
 * A green run here means the nesting is not deeper than the rule allows, not that it is
 * right.
 */
final class ContractPathNestingTest {

    private static final int MAX_SUB_RESOURCE_LEVELS = 3;

    /**
     * Segments that group operations without naming a resource — {@code /admin} is not a
     * collection of administrations. Counting them as a level would make paths look one
     * deeper than they are. Add a namespace here when the contract introduces one.
     */
    private static final Set<String> NAMESPACES = Set.of("admin");

    @Test
    void noDeclaredPathNestsBeyondThreeSubResourceLevels() throws IOException {
        List<String> tooDeep = new ArrayList<>();
        for (String path : ContractDocument.declaredPaths()) {
            if (subResourceLevels(path) > MAX_SUB_RESOURCE_LEVELS) {
                tooDeep.add(path + " (" + subResourceLevels(path) + " levels)");
            }
        }

        assertThat(tooDeep)
                .as("ADR-020 caps nesting at %d sub-resource levels. A path deeper than that is "
                        + "usually a resource that should be parented elsewhere, or one that has "
                        + "earned an identifier of its own", MAX_SUB_RESOURCE_LEVELS)
                .isEmpty();
    }

    /** Shows the rule fires, so a green run above means the contract is shallow. */
    @Test
    void theCounterFlagsAPathPlantedBeyondTheCap() {
        assertThat(subResourceLevels("/orders/{orderId}/lines/{lineId}/notes/latest")).isEqualTo(3);
        assertThat(subResourceLevels("/orders/{orderId}/lines/{lineId}/notes/latest/body"))
                .isGreaterThan(MAX_SUB_RESOURCE_LEVELS);
    }

    @Test
    void namespaceSegmentsDoNotCountAsALevel() {
        assertThat(subResourceLevels("/admin/imports/{importId}/cancel")).isEqualTo(1);
        assertThat(subResourceLevels("/items")).isZero();
        assertThat(subResourceLevels("/items/{itemId}")).isZero();
    }

    /**
     * Static segments below the root collection. Path variables are not levels —
     * {@code /items/{itemId}} addresses a member of {@code /items}.
     */
    private static int subResourceLevels(String path) {
        List<String> statics = new ArrayList<>();
        for (String segment : path.split("/")) {
            if (!segment.isEmpty() && !segment.startsWith("{")) {
                statics.add(segment);
            }
        }
        if (statics.isEmpty()) {
            return 0;
        }
        int root = NAMESPACES.contains(statics.get(0)) ? 2 : 1;
        return Math.max(0, statics.size() - root);
    }
}
