package com.example.app.portal.security;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.spi.ILoggingEvent;
import com.example.app.portal.LogCapture;
import com.example.app.portal.config.PortalProperties;
import com.example.app.portal.config.PortalProperties.Auth;
import com.example.app.portal.config.PortalProperties.Mode;
import com.example.app.portal.config.PortalProperties.Oidc;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;
import tools.jackson.databind.json.JsonMapper;

/**
 * The branches of the security handlers the HTTP suites do not reach: a login failure
 * that is not an OAuth2 error, and a logout with no authentication (dev mode is
 * stateless, so there is nobody to name).
 */
class BffSecurityHandlersTest {

    private static final PortalProperties PROPERTIES = new PortalProperties("http://localhost:8080", 1,
            Duration.ofSeconds(1), new Auth(Mode.OIDC, null), new Oidc(null, null, null, List.of(), null));

    @Test
    void aLoginFailureThatIsNotAnOAuth2ErrorIsNamedByItsType() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        try (LogCapture log = LogCapture.of(BffSecurityHandlers.class)) {
            BffSecurityHandlers.loginFailed(PROPERTIES, JsonMapper.builder().build())
                    .onAuthenticationFailure(new MockHttpServletRequest(), response, new BadCredentialsException("x"));

            assertThat(log.events()).extracting(ILoggingEvent::getFormattedMessage)
                    .containsExactly("Login failed: BadCredentialsException");
        }
        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentAsString()).contains("\"code\":\"LOGIN_FAILED\"");
    }

    @Test
    void aLogoutWithoutAnAuthenticationStillAnswersNoContent() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        try (LogCapture log = LogCapture.of(BffSecurityHandlers.class)) {
            BffSecurityHandlers.loggedOut().onLogoutSuccess(new MockHttpServletRequest(), response, null);

            assertThat(log.events()).extracting(ILoggingEvent::getFormattedMessage).containsExactly("Logged out: -");
        }
        assertThat(response.getStatus()).isEqualTo(204);
    }
}
