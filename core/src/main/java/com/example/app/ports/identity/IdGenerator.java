package com.example.app.ports.identity;

import java.util.UUID;

/**
 * Outbound port for generating a unique identifier (ADR-023).
 *
 * <p>The JDK offers no abstraction for this; the JVM adapter is
 * {@code UUID::randomUUID}.
 */
@FunctionalInterface
public interface IdGenerator {
    UUID generate();
}
