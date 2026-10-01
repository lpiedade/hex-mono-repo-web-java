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
    /** May read items. */
    READER,
    /** May create, change and delete items. */
    EDITOR,
    /** Administers the application; no operation of the example resource requires it. */
    ADMIN;

    /**
     * The prefix Spring Security's {@code hasRole} expects on an authority name. Spelled
     * out here as a plain string, so {@code core} names the convention without depending
     * on the framework.
     */
    public static final String AUTHORITY_PREFIX = "ROLE_";

    /**
     * Every role, in canonical order.
     *
     * @return an immutable list of every constant, in declaration order
     */
    public static List<AppRole> all() {
        return List.of(values());
    }

    /**
     * The roles whose {@link #authority()} appears in the given granted
     * authorities, as an {@link EnumSet} (so iteration is in canonical order).
     * Authorities that name no role are ignored.
     *
     * @param authorities granted-authority names, such as {@code ROLE_READER}
     * @return the matching roles; empty when none match
     */
    public static Set<AppRole> fromAuthorities(Collection<String> authorities) {
        return all().stream()
                .filter(role -> authorities.contains(role.authority()))
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(AppRole.class)));
    }

    /**
     * The granted-authority name for this role.
     *
     * @return {@link #AUTHORITY_PREFIX} followed by the constant's name, e.g.
     *         {@code ROLE_READER}
     */
    public String authority() {
        return AUTHORITY_PREFIX + name();
    }
}
