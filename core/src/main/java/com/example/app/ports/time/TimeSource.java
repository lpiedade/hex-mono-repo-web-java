package com.example.app.ports.time;

import java.time.Instant;

/**
 * Outbound port for obtaining the current wall-clock instant.
 *
 * <p>Separate from {@link Ticker} because a wall clock may jump (DST, NTP slew)
 * and a duration measured across a jump produces a wrong result.
 *
 * <p>The JVM adapter is {@code Instant::now}. No default factory lives here:
 * placing one would put {@code Instant.now()} inside {@code ports}, defeating
 * the purpose of naming this boundary (ADR-015 rule 8).
 */
@FunctionalInterface
public interface TimeSource {
    Instant now();
}
