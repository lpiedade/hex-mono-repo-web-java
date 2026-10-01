package com.example.app.portal;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.encoder.PatternLayoutEncoder;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.OutputStreamAppender;
import com.example.app.portal.web.CorrelationId;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import javax.xml.parsers.DocumentBuilderFactory;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.w3c.dom.Document;

/**
 * The two claims the BFF's {@code logback-spring.xml} makes (ADR-016): a line carries the
 * request's correlation id, and a message cannot forge a line of its own. Logback accepts
 * a malformed pattern without failing startup, so only rendering through the committed
 * pattern proves either.
 */
class BffLogPatternTest {

    private static final String CONFIG = "/logback-spring.xml";

    @Test
    void theCommittedPatternRendersTheCorrelationId() throws Exception {
        String pattern = declaredPattern();

        assertThat(render(pattern, "abc-123", "proxied")).contains("[abc-123]").contains("proxied");
        assertThat(pattern).contains("%X{" + CorrelationId.MDC_KEY);
    }

    @Test
    void aNewlineInTheMessageCannotForgeALineOfItsOwn() throws Exception {
        String line = render(declaredPattern(), "abc-123",
                "GET /app/bff/v1/items\r\n2026-01-01T00:00:00.000 ERROR [app-portal] forged line");

        assertThat(line.strip()).doesNotContain("\n").doesNotContain("\r");
        assertThat(line).contains("GET /app/bff/v1/items 2026-01-01T00:00:00.000 ERROR [app-portal] forged line");
    }

    private static String declaredPattern() throws Exception {
        try (InputStream config = BffLogPatternTest.class.getResourceAsStream(CONFIG)) {
            assertThat(config).as("%s must be on the classpath", CONFIG).isNotNull();
            Document document = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(config);
            var patterns = document.getElementsByTagName("pattern");
            assertThat(patterns.getLength()).as("exactly one appender pattern").isEqualTo(1);
            return patterns.item(0).getTextContent().trim();
        }
    }

    /**
     * Formats one event through {@code pattern} with a correlation id bound. It borrows the
     * ambient {@link LoggerContext}: {@link MDC} writes through that context's adapter, so
     * a fresh context would render an empty MDC.
     */
    private static String render(String pattern, String correlationId, String message) {
        LoggerContext context = (LoggerContext) LoggerFactory.getILoggerFactory();
        ByteArrayOutputStream captured = new ByteArrayOutputStream();

        PatternLayoutEncoder encoder = new PatternLayoutEncoder();
        encoder.setContext(context);
        encoder.setPattern(pattern);
        encoder.start();

        OutputStreamAppender<ILoggingEvent> appender = new OutputStreamAppender<>();
        appender.setContext(context);
        appender.setEncoder(encoder);
        appender.setOutputStream(captured);
        appender.start();

        Logger logger = context.getLogger(BffLogPatternTest.class.getName());
        logger.setAdditive(false);
        logger.addAppender(appender);
        try {
            MDC.put(CorrelationId.MDC_KEY, correlationId);
            logger.info(message);
        } finally {
            MDC.remove(CorrelationId.MDC_KEY);
            logger.detachAppender(appender);
            appender.stop();
        }
        return captured.toString();
    }
}
