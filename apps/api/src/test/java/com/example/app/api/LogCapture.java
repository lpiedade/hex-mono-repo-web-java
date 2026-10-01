package com.example.app.api;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.util.List;
import java.util.function.Predicate;
import org.slf4j.LoggerFactory;

/**
 * Records what one logger emits while a test runs, so a suite can assert a log line was
 * written — its level, its message, and the MDC it was written under. Use it in
 * try-with-resources: closing detaches the appender, so one suite's capture never
 * leaks into the next.
 *
 * <p>Works for the {@code *IT} suites too: the application under test runs in the same
 * JVM, and logback is one context per JVM.
 */
public final class LogCapture implements AutoCloseable {

    private final Logger logger;
    private final ListAppender<ILoggingEvent> appender = new ListAppender<>();

    private LogCapture(String loggerName) {
        this.logger = (Logger) LoggerFactory.getLogger(loggerName);
        appender.start();
        logger.addAppender(appender);
    }

    public static LogCapture of(String loggerName) {
        return new LogCapture(loggerName);
    }

    public static LogCapture of(Class<?> loggerClass) {
        return new LogCapture(loggerClass.getName());
    }

    /** Every event captured so far, in order. */
    public List<ILoggingEvent> events() {
        return List.copyOf(appender.list);
    }

    /** The captured events whose formatted message satisfies {@code test}. */
    public List<ILoggingEvent> matching(Predicate<String> test) {
        return events().stream().filter(event -> test.test(event.getFormattedMessage())).toList();
    }

    @Override
    public void close() {
        logger.detachAppender(appender);
        appender.stop();
    }
}
