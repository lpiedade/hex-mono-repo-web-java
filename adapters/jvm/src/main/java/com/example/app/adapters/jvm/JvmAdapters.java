package com.example.app.adapters.jvm;

import com.example.app.ports.identity.IdGenerator;
import com.example.app.ports.time.Ticker;
import com.example.app.ports.time.TimeSource;
import java.time.Instant;
import java.util.UUID;

/**
 * Factory methods that bind the three non-deterministic core ports to their
 * host-JVM implementations (ADR-015 rule 8).
 *
 * <p>Each method returns a method reference so the composition root can wire
 * it as a {@code @Bean} without naming an implementing class.
 */
public final class JvmAdapters {

    private JvmAdapters() {}

    public static TimeSource systemTimeSource() {
        return Instant::now;
    }

    public static Ticker systemTicker() {
        return System::nanoTime;
    }

    public static IdGenerator randomIdGenerator() {
        return UUID::randomUUID;
    }
}
