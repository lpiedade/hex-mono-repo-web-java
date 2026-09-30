package com.example.app.domain.item;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * The template's example aggregate: a named thing with an optional description.
 * Replace it with the new project's first real aggregate.
 *
 * <p>Immutable. Every value is validated on construction, so an {@code Item}
 * that exists is a valid one; {@link #revise} returns a new instance rather than
 * mutating this one. The identifier and both instants are supplied by the caller
 * — the flow takes them from ports — so constructing an item never reads the
 * clock or invents an id (ADR-015 rule 8).
 */
public record Item(UUID id, String name, String description, Instant createdAt, Instant updatedAt) {

    public static final int NAME_MAX_LENGTH = 120;
    public static final int DESCRIPTION_MAX_LENGTH = 1000;

    public Item {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(updatedAt, "updatedAt");
        name = validName(name);
        description = validDescription(description);
        if (updatedAt.isBefore(createdAt)) {
            throw new InvalidItemException("updatedAt precedes createdAt");
        }
    }

    /** A new item, created and last updated at {@code now}. */
    public static Item create(UUID id, String name, String description, Instant now) {
        return new Item(id, name, description, now, now);
    }

    /** This item with new editable fields, last updated at {@code now}. */
    public Item revise(String newName, String newDescription, Instant now) {
        return new Item(id, newName, newDescription, createdAt, now);
    }

    private static String validName(String name) {
        String trimmed = name == null ? "" : name.strip();
        if (trimmed.isEmpty()) {
            throw new InvalidItemException("name is blank");
        }
        if (trimmed.length() > NAME_MAX_LENGTH) {
            throw new InvalidItemException("name exceeds " + NAME_MAX_LENGTH + " characters");
        }
        return trimmed;
    }

    /** Blank and absent are the same thing: no description. */
    private static String validDescription(String description) {
        if (description == null || description.isBlank()) {
            return null;
        }
        String trimmed = description.strip();
        if (trimmed.length() > DESCRIPTION_MAX_LENGTH) {
            throw new InvalidItemException("description exceeds " + DESCRIPTION_MAX_LENGTH + " characters");
        }
        return trimmed;
    }
}
