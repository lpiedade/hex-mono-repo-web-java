package com.example.app.api;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.encoder.PatternLayoutEncoder;
import ch.qos.logback.core.OutputStreamAppender;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import javax.xml.parsers.DocumentBuilderFactory;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.w3c.dom.Document;

/**
 * Guards the claims {@code logback-spring.xml} exists to make (ADR-016): a log line carries
 * the request's correlation id, with a {@code -} placeholder outside any request; it
 * carries the caller's subject the same way; and a CR or LF in a message cannot forge a
 * line of its own.
 *
 * <p>A passing build does not establish any of this. Logback tolerates a malformed
 * pattern — an unrecognised conversion word degrades to literal text or nothing rather
 * than failing startup — so the API could boot, serve, and log perfectly happily while
 * silently dropping a field, with {@code CorrelationIdFilter} writing an MDC nothing reads.
 *
 * <p>The pattern is read out of the committed file rather than repeated here, so the test
 * cannot pass against a pattern the application does not use.
 */
class LogPatternTest {

    private static final String CONFIG = "/logback-spring.xml";

    @Test
    void committedPatternRendersTheCorrelationId() throws Exception {
        String pattern = declaredPattern();

        String line = render(pattern, "correlationId", "abc-123", "item created");

        assertThat(line).contains("abc-123");
        assertThat(line).contains("item created");
        // The %X conversion has to name the same key CorrelationId.MDC_KEY binds, or the
        // id is bound and never printed.
        assertThat(pattern).contains("%X{" + com.example.app.api.web.CorrelationId.MDC_KEY);
    }

    @Test
    void aLineOutsideAnyRequestStillCarriesTheField() throws Exception {
        // Startup and schedule ticks log with no correlation id bound. The pattern
        // declares a "-" default so the line keeps its column count and stays parseable
        // by position rather than collapsing into a shorter, differently-shaped record.
        String line = render(declaredPattern(), "unrelated", "x", "worker started");

        assertThat(line).contains("[-]");
        assertThat(line).contains("worker started");
    }

    @Test
    void aNewlineInTheMessageCannotForgeALineOfItsOwn() throws Exception {
        // A value a client supplied — a path, an error's text — can reach a message. With
        // a raw CR/LF in it, what follows would read as a separate, forged log line.
        String line = render(declaredPattern(), "correlationId", "abc-123",
                "item created\r\n2026-01-01T00:00:00.000 ERROR [app-api] forged line");

        assertThat(line.strip()).doesNotContain("\n").doesNotContain("\r");
        assertThat(line).endsWith(System.lineSeparator());
        assertThat(line).contains("item created 2026-01-01T00:00:00.000 ERROR [app-api] forged line");
    }

    @Test
    void theSubjectIsPrintedWhenBoundAndAPlaceholderOtherwise() throws Exception {
        String pattern = declaredPattern();

        assertThat(render(pattern, "subject", "dev@app.local", "item created")).contains("[dev@app.local]");
        assertThat(pattern).contains("%X{subject:--}");
    }

    /** The {@code <pattern>} declared by the application's own logback configuration. */
    private static String declaredPattern() throws Exception {
        try (InputStream config = LogPatternTest.class.getResourceAsStream(CONFIG)) {
            assertThat(config).as("%s must be on the classpath", CONFIG).isNotNull();
            Document document = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(config);
            var patterns = document.getElementsByTagName("pattern");
            assertThat(patterns.getLength()).as("exactly one appender pattern").isEqualTo(1);
            return patterns.item(0).getTextContent().trim();
        }
    }

    /**
     * Formats one event through {@code pattern}, with {@code mdcKey} bound.
     *
     * <p>It borrows the ambient {@link LoggerContext} rather than building a fresh one:
     * {@link MDC} writes through the provider's own adapter, and an independent context
     * would carry a different adapter, so the event would render with an empty MDC and
     * the test would fail for a reason that has nothing to do with the pattern.
     */
    private static String render(String pattern, String mdcKey, String mdcValue, String message) {
        LoggerContext context = (LoggerContext) LoggerFactory.getILoggerFactory();
        ByteArrayOutputStream captured = new ByteArrayOutputStream();

        PatternLayoutEncoder encoder = new PatternLayoutEncoder();
        encoder.setContext(context);
        encoder.setPattern(pattern);
        encoder.start();

        OutputStreamAppender<ch.qos.logback.classic.spi.ILoggingEvent> appender = new OutputStreamAppender<>();
        appender.setContext(context);
        appender.setEncoder(encoder);
        appender.setOutputStream(captured);
        appender.start();

        Logger logger = context.getLogger(LogPatternTest.class.getName() + "." + mdcKey);
        logger.setAdditive(false);
        logger.addAppender(appender);
        try {
            MDC.put(mdcKey, mdcValue);
            logger.info(message);
        } finally {
            MDC.remove(mdcKey);
            logger.detachAppender(appender);
            appender.stop();
        }
        return captured.toString();
    }
}
