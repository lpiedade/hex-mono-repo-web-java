package com.example.app.api.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.app.api.LogCapture;
import com.example.app.api.security.SubjectMdcFilter;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

/**
 * The access filter's edges that {@code LoggingIT} cannot reach over HTTP: a chain that
 * throws still leaves its line and still unbinds the subject, and every health path is
 * skipped, not only {@code /actuator/health} itself.
 */
class RequestLogFilterTest {

    private final RequestLogFilter filter = new RequestLogFilter();

    @AfterEach
    void clearMdc() {
        MDC.clear();
    }

    @Test
    void aRequestThatFailsIsStillLoggedAndItsSubjectUnbound() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/items");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MDC.put(SubjectMdcFilter.MDC_KEY, "someone");

        try (LogCapture access = LogCapture.of(RequestLogFilter.LOGGER)) {
            assertThatThrownBy(() -> filter.doFilter(request, response, (req, res) -> {
                throw new ServletException("boom");
            })).isInstanceOf(ServletException.class);

            assertThat(access.events()).singleElement()
                    .satisfies(event -> assertThat(event.getFormattedMessage()).startsWith("POST /api/v1/items "));
        }
        assertThat(MDC.get(SubjectMdcFilter.MDC_KEY)).isNull();
    }

    @Test
    void healthProbesAreNotLogged() throws Exception {
        try (LogCapture access = LogCapture.of(RequestLogFilter.LOGGER)) {
            filter.doFilter(new MockHttpServletRequest("GET", "/actuator/health/readiness"),
                    new MockHttpServletResponse(), new MockFilterChain());

            assertThat(access.events()).isEmpty();
        }
    }
}
