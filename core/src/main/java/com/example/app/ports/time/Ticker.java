package com.example.app.ports.time;

/**
 * Outbound port for reading a monotonic nanosecond counter.
 *
 * <p>Measures elapsed durations. Deliberately separate from {@link TimeSource}:
 * a wall clock may jump, making wall-clock subtraction wrong for elapsed-time
 * accounting. The JVM adapter is {@code System::nanoTime}.
 *
 * <p>Usage: call {@code read()} before the operation and after, then compute
 * elapsed milliseconds as {@code (after - before) / 1_000_000L}.
 */
@FunctionalInterface
public interface Ticker {

    /**
     * The current reading of the counter.
     *
     * @return nanoseconds from an arbitrary origin; meaningful only as the difference
     *         between two readings of the same ticker
     */
    long read();
}
