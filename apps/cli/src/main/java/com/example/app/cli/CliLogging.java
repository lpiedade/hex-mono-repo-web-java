package com.example.app.cli;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.LoggerContext;
import org.slf4j.LoggerFactory;

/**
 * The CLI's control over its own log levels (ADR-016). {@code logback.xml} sends every
 * line to stderr and keeps the root at WARN; {@code --verbose} raises the application's
 * own loggers to DEBUG and everything else only to INFO, so the lines an operator asked
 * for are not buried under library detail.
 *
 * <p>Naming logback here is deliberate: an app is the one place allowed to know its
 * backend.
 */
final class CliLogging {

    static final String APP_LOGGER = "com.example.app";

    private CliLogging() {
    }

    static void applyVerbose(boolean verbose) {
        if (!verbose) {
            return;
        }
        if (LoggerFactory.getILoggerFactory() instanceof LoggerContext context) {
            context.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME).setLevel(Level.INFO);
            context.getLogger(APP_LOGGER).setLevel(Level.DEBUG);
        }
    }
}
