package com.example.app.cli;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.core.ConsoleAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import picocli.CommandLine;
import picocli.CommandLine.Command;
import picocli.CommandLine.Mixin;

/**
 * The two halves of the CLI's logging contract (ADR-016): the committed
 * {@code logback.xml} keeps the CLI quiet and off stdout, and {@code --verbose} actually
 * moves a log level. The second needs a test because the flag is wired through a picocli
 * <em>setter</em>, which fails silently if picocli does not honour it.
 */
class CliLoggingTest {

    /** A stand-in subcommand: ServiceOptions is a mixin and cannot be parsed alone. */
    @Command(name = "probe")
    static final class Probe {
        @Mixin
        ServiceOptions service;
    }

    private static LoggerContext context() {
        return (LoggerContext) LoggerFactory.getILoggerFactory();
    }

    @AfterEach
    void restoreLevels() {
        context().getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME).setLevel(Level.WARN);
        context().getLogger(CliLogging.APP_LOGGER).setLevel(null);
    }

    @Test
    void committedConfigurationKeepsTheCliQuietAndOffStdout() {
        var root = context().getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME);

        assertThat(root.getLevel()).isEqualTo(Level.WARN);
        assertThat(root.iteratorForAppenders().hasNext()).as("the root logger must have an appender").isTrue();
        root.iteratorForAppenders().forEachRemaining(appender -> {
            if (appender instanceof ConsoleAppender<?> console) {
                assertThat(console.getTarget()).as(console.getName()).isEqualTo("System.err");
            }
        });
    }

    @Test
    void verboseRaisesTheApplicationLevelThroughPicocli() {
        Probe probe = new Probe();

        new CommandLine(probe).parseArgs("--verbose");

        assertThat(probe.service.verbose).isTrue();
        assertThat(context().getLogger(CliLogging.APP_LOGGER).getLevel()).isEqualTo(Level.DEBUG);
        assertThat(context().getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME).getLevel()).isEqualTo(Level.INFO);
    }

    @Test
    void withoutTheFlagNoLevelMoves() {
        Probe probe = new Probe();

        new CommandLine(probe).parseArgs("--api-url", "http://example.com");

        assertThat(probe.service.verbose).isFalse();
        assertThat(probe.service.apiUrl).isEqualTo("http://example.com");
        assertThat(context().getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME).getLevel()).isEqualTo(Level.WARN);
    }
}
