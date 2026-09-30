package com.example.app.domain.security;

import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * The application's roles (ADR-011), declared in the order the user-context
 * contract lists them. Enum order is the wire order: callers that emit the full
 * set produce a deterministic, contract-matching sequence.
 *
 * <p>Replace or extend these with the new project's roles; keep the contract's
 * {@code UserContext.roles} enum in step.
 */
public enum AppRole {
    READER,
    EDITOR,
    ADMIN;

    /** Spring Security authority prefix convention. */
    public static final String AUTHORITY_PREFIX = "ROLE_";

    /** Every role, in canonical order. */
    public static List<AppRole> all() {
        return List.of(values());
    }

    /**
     * The roles whose {@link #authority()} appears in the given granted
     * authorities, as an {@link EnumSet} (so iteration is in canonical order).
     */
    public static Set<AppRole> fromAuthorities(Collection<String> authorities) {
        return all().stream()
                .filter(role -> authorities.contains(role.authority()))
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(AppRole.class)));
    }

    /** The granted-authority name for this role, e.g. {@code ROLE_READER}. */
    public String authority() {
        return AUTHORITY_PREFIX + name();
    }
}
