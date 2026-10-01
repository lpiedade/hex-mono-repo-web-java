package com.example.app.adapters.jvm;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

/**
 * Each factory binds its port to the host JVM: the time source reads the real clock, the
 * ticker never runs backwards, and the id generator yields distinct random UUIDs.
 */
class JvmAdaptersTest {

    @Test
    void theTimeSourceReadsTheHostClock() {
        Instant read = JvmAdapters.systemTimeSource().now();

        assertThat(Duration.between(read, Instant.now()).abs()).isLessThan(Duration.ofSeconds(5));
    }

    @Test
    void theTickerIsMonotonic() {
        long before = JvmAdapters.systemTicker().read();
        long after = JvmAdapters.systemTicker().read();

        assertThat(after).isGreaterThanOrEqualTo(before);
    }

    @Test
    void theIdGeneratorProducesRandomVersion4Uuids() {
        var first = JvmAdapters.randomIdGenerator().generate();
        var second = JvmAdapters.randomIdGenerator().generate();

        assertThat(first).isNotEqualTo(second);
        assertThat(first.version()).isEqualTo(4);
    }
}
