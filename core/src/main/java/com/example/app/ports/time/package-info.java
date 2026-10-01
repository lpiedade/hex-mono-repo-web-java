/**
 * {@link TimeSource} for wall-clock instants and {@link Ticker} for elapsed time, kept apart
 * because a wall clock may jump. The JVM implementations live in {@code adapters/jvm}
 * (ADR-015 rule 8).
 */
package com.example.app.ports.time;
