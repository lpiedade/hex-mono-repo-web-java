package com.example.app.architecture.fixtures.flows.host;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.Year;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Supplier;

/**
 * Plants rule 8, once per member of its set, and never runs. See the README.
 *
 * <p>{@link #asAMethodReference()} is the important one: {@code Instant::now} is a method
 * reference, which is different bytecode from a call. It is exactly how
 * {@code adapters/jvm} supplies the value, so it is the shape in which the crossing could
 * come back into {@code core} unnoticed.
 */
public final class ReadsTheHost {

    private ReadsTheHost() {}

    static String everyClock() {
        return Instant.now()
                + LocalDate.now().toString()
                + LocalDateTime.now()
                + LocalTime.now()
                + OffsetDateTime.now(ZoneOffset.UTC)
                + ZonedDateTime.now()
                + Year.now()
                + YearMonth.now()
                + System.currentTimeMillis()
                + System.nanoTime();
    }

    static String everyGenerator() {
        return UUID.randomUUID() + String.valueOf(Math.random()) + ThreadLocalRandom.current().nextInt();
    }

    static Supplier<Instant> asAMethodReference() {
        return Instant::now;
    }

    /**
     * The randomness types as parameters rather than constructor calls, because an injected
     * source is the same crossing and is not a {@code new}.
     */
    @SuppressWarnings("unused")
    static void injectedRandomness(Random random, SecureRandom secureRandom) {
        // Deliberately empty: rule 8 judges the dependency on the type.
    }
}
