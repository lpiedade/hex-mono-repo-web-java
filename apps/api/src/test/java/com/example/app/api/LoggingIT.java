package com.example.app.api;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.spi.ILoggingEvent;
import com.example.app.api.item.ItemController;
import com.example.app.api.security.ProblemDetailsAuthenticationEntryPoint;
import com.example.app.api.web.RequestLogFilter;
import java.net.http.HttpResponse;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * The lines the running API writes for a request (ADR-016): one access line, attributed
 * to the caller; one audit line per successful write; and a reasoned line when
 * authentication is refused. Asserted on the events themselves — level, message and MDC —
 * so the test does not depend on the pattern (LogPatternTest owns that).
 */
class LoggingIT extends ApiIntegrationTest {

    @Test
    void everyRequestLeavesOneAccessLineWithItsSubjectAndCorrelationId() throws Exception {
        try (LogCapture access = LogCapture.of(RequestLogFilter.LOGGER)) {
            get("/api/v1/items?name=secret", "Authorization", bearer(), "X-Correlation-ID", "access-1");

            ILoggingEvent line = access.matching(message -> message.startsWith("GET /api/v1/items ")).getFirst();
            assertThat(line.getLevel()).isEqualTo(Level.INFO);
            assertThat(line.getFormattedMessage()).matches("GET /api/v1/items 200 \\d+ms");
            assertThat(line.getMDCPropertyMap())
                    .containsEntry("correlationId", "access-1")
                    .containsEntry("subject", "dev@app.local");
        }
    }

    @Test
    void theQueryStringAndHealthProbesStayOutOfTheAccessLog() throws Exception {
        try (LogCapture access = LogCapture.of(RequestLogFilter.LOGGER)) {
            get("/api/v1/items?name=secret", "Authorization", bearer());
            get("/actuator/health");

            assertThat(access.events()).extracting(ILoggingEvent::getFormattedMessage)
                    .noneMatch(message -> message.contains("secret"))
                    .noneMatch(message -> message.contains("/actuator/health"));
        }
    }

    @Test
    void anAnonymousRequestIsLoggedWithoutASubject() throws Exception {
        try (LogCapture access = LogCapture.of(RequestLogFilter.LOGGER)) {
            get("/api/v1/items");

            ILoggingEvent line = access.matching(message -> message.startsWith("GET /api/v1/items 401")).getFirst();
            assertThat(line.getMDCPropertyMap()).doesNotContainKey("subject");
        }
    }

    @Test
    void everySuccessfulWriteLeavesAnAuditLineNamingTheItemByIdOnly() throws Exception {
        String name = "Audited " + UUID.randomUUID();
        try (LogCapture audit = LogCapture.of(ItemController.AUDIT_LOGGER)) {
            HttpResponse<String> created =
                    send("POST", "/api/v1/items", "{\"name\":\"" + name + "\"}", "Authorization", bearer());
            String id = json(created.body()).get("id").asString();
            send("PUT", "/api/v1/items/" + id, "{\"name\":\"" + name + " 2\"}", "Authorization", bearer());
            send("DELETE", "/api/v1/items/" + id, null, "Authorization", bearer());
            send("DELETE", "/api/v1/items/" + id, null, "Authorization", bearer()); // 404: not a write

            assertThat(audit.events()).extracting(ILoggingEvent::getFormattedMessage).containsExactly(
                    "item.created id=" + id, "item.updated id=" + id, "item.deleted id=" + id);
            assertThat(audit.events()).allSatisfy(event -> {
                assertThat(event.getMDCPropertyMap()).containsEntry("subject", "dev@app.local");
                assertThat(event.getFormattedMessage()).doesNotContain(name);
            });
        }
    }

    @Test
    void aMissingCredentialIsLoggedAtInfo() throws Exception {
        try (LogCapture security = LogCapture.of(ProblemDetailsAuthenticationEntryPoint.class)) {
            get("/api/v1/items");

            assertThat(security.events()).singleElement().satisfies(event -> {
                assertThat(event.getLevel()).isEqualTo(Level.INFO);
                assertThat(event.getFormattedMessage()).isEqualTo("Authentication required: GET /api/v1/items");
            });
        }
    }
}
