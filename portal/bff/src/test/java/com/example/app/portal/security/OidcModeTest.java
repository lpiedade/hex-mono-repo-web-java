package com.example.app.portal.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.example.app.portal.TestAutoConfigurationExclusions;
import com.example.app.portal.web.BffEnvelopeFilter;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * The default browser mode (ADR-010) against a stub that plays both the identity
 * provider — serving the OIDC discovery document the BFF reads at startup — and the
 * application API, recording what the BFF relays to it.
 */
@SpringBootTest(properties = "spring.autoconfigure.exclude=" + TestAutoConfigurationExclusions.VALUE)
class OidcModeTest {

    private static final AtomicReference<String> RELAYED_AUTHORIZATION = new AtomicReference<>();
    private static final AtomicReference<String> RELAYED_COOKIE = new AtomicReference<>();
    private static final HttpServer STUB = startStub();
    private static final String BASE = "http://localhost:" + STUB.getAddress().getPort();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("app.bff.auth.mode", () -> "oidc");
        registry.add("app.bff.oidc.issuer-uri", () -> BASE);
        registry.add("app.bff.oidc.client-id", () -> "portal");
        registry.add("app.bff.oidc.client-secret", () -> "secret");
        registry.add("app.bff.api-base-url", () -> BASE);
    }

    @AfterAll
    static void stopStub() {
        STUB.stop(0);
    }

    @Autowired
    WebApplicationContext context;

    @Autowired
    ClientRegistrationRepository registrations;

    @Autowired
    OAuth2AuthorizedClientRepository authorizedClients;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        RELAYED_AUTHORIZATION.set(null);
        RELAYED_COOKIE.set(null);
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .addFilters(new BffEnvelopeFilter(1))
                .apply(springSecurity())
                .build();
    }

    @Test
    void aCallWithoutASessionIsSessionRequiredNotARedirect() throws Exception {
        MvcResult result = mvc.perform(get("/app/bff/v1/items")).andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(401);
        assertThat(result.getResponse().getContentAsString()).contains("\"code\":\"SESSION_REQUIRED\"");
        assertThat(result.getResponse().getHeader("X-Portal-Api-Version")).isEqualTo("1");
        assertThat(RELAYED_AUTHORIZATION.get()).isNull();
    }

    @Test
    void loginStartsTheAuthorizationCodeFlowAtTheProvider() throws Exception {
        MvcResult result = mvc.perform(get("/app/bff/oauth2/authorization/oidc")).andReturn();

        String location = result.getResponse().getRedirectedUrl();
        assertThat(result.getResponse().getStatus()).isEqualTo(302);
        assertThat(location).startsWith(BASE + "/authorize")
                .contains("client_id=portal")
                .contains("response_type=code")
                .contains("redirect_uri=http://localhost/app/bff/login/oauth2/code/oidc")
                // PKCE and a nonce, which Spring Security adds for OIDC by default.
                .contains("code_challenge_method=S256")
                .contains("nonce=");
    }

    @Test
    void healthAndAboutArePublicAndACsrfCookieIsIssued() throws Exception {
        MvcResult health = mvc.perform(get("/app/health")).andReturn();

        assertThat(health.getResponse().getStatus()).isEqualTo(200);
        assertThat(health.getResponse().getCookie("XSRF-TOKEN")).isNotNull();
        assertThat(mvc.perform(get("/app/about")).andReturn().getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    void theSessionsAccessTokenIsRelayedAndTheBrowsersCredentialsAreNot() throws Exception {
        MockHttpSession session = new MockHttpSession();
        OAuth2AuthenticationToken user = signIn(session, Instant.now().plusSeconds(300));

        MvcResult result = mvc.perform(get("/app/bff/v1/items")
                        .session(session)
                        .with(authentication(user))
                        .header("Cookie", "JSESSIONID=browser"))
                .andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(RELAYED_AUTHORIZATION.get()).isEqualTo("Bearer access-token");
        assertThat(RELAYED_COOKIE.get()).isNull();
    }

    @Test
    void anExpiredTokenThatCannotBeRefreshedMeansLogInAgain() throws Exception {
        MockHttpSession session = new MockHttpSession();
        OAuth2AuthenticationToken user = signIn(session, Instant.now().minusSeconds(5));

        MvcResult result = mvc.perform(get("/app/bff/v1/items").session(session).with(authentication(user)))
                .andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(401);
        assertThat(result.getResponse().getContentAsString()).contains("SESSION_REQUIRED");
        assertThat(RELAYED_AUTHORIZATION.get()).isNull();
    }

    @Test
    void aMutationWithoutTheCsrfTokenIsRefused() throws Exception {
        MockHttpSession session = new MockHttpSession();
        OAuth2AuthenticationToken user = signIn(session, Instant.now().plusSeconds(300));

        MvcResult refused = mvc.perform(post("/app/bff/v1/items").session(session).with(authentication(user))
                        .contentType("application/json").content("{\"name\":\"x\"}"))
                .andReturn();
        assertThat(refused.getResponse().getStatus()).isEqualTo(403);
        assertThat(refused.getResponse().getContentAsString()).contains("\"code\":\"FORBIDDEN\"");

        MvcResult accepted = mvc.perform(post("/app/bff/v1/items").session(session).with(authentication(user))
                        .with(csrf())
                        .contentType("application/json").content("{\"name\":\"x\"}"))
                .andReturn();
        assertThat(accepted.getResponse().getStatus()).isEqualTo(201);
    }

    @Test
    void logoutEndsTheSessionWithNoContent() throws Exception {
        MockHttpSession session = new MockHttpSession();
        OAuth2AuthenticationToken user = signIn(session, Instant.now().plusSeconds(300));

        MvcResult result = mvc.perform(post("/app/bff/logout").session(session).with(authentication(user))
                .with(csrf())).andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(204);
        assertThat(session.isInvalid()).isTrue();
    }

    /** What a completed login leaves behind: the user, and their tokens in the session. */
    private OAuth2AuthenticationToken signIn(MockHttpSession session, Instant tokenExpiry) {
        var principal = new DefaultOAuth2User(
                List.of(new SimpleGrantedAuthority("OIDC_USER")), Map.of("sub", "someone"), "sub");
        var user = new OAuth2AuthenticationToken(principal, principal.getAuthorities(), "oidc");
        var token = new OAuth2AccessToken(
                OAuth2AccessToken.TokenType.BEARER, "access-token", tokenExpiry.minusSeconds(600), tokenExpiry);
        var client = new OAuth2AuthorizedClient(registrations.findByRegistrationId("oidc"), "someone", token);
        var request = new MockHttpServletRequest();
        request.setSession(session);
        authorizedClients.saveAuthorizedClient(client, user, request, new MockHttpServletResponse());
        return user;
    }

    private static HttpServer startStub() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
            String base = "http://localhost:" + server.getAddress().getPort();
            server.createContext("/.well-known/openid-configuration", exchange -> respond(exchange, 200, """
                    {"issuer":"%1$s","authorization_endpoint":"%1$s/authorize","token_endpoint":"%1$s/token",
                     "jwks_uri":"%1$s/jwks","userinfo_endpoint":"%1$s/userinfo",
                     "response_types_supported":["code"],"subject_types_supported":["public"],
                     "id_token_signing_alg_values_supported":["RS256"]}
                    """.formatted(base)));
            server.createContext("/api/v1/items", exchange -> {
                RELAYED_AUTHORIZATION.set(exchange.getRequestHeaders().getFirst("Authorization"));
                RELAYED_COOKIE.set(exchange.getRequestHeaders().getFirst("Cookie"));
                boolean create = exchange.getRequestMethod().equals("POST");
                respond(exchange, create ? 201 : 200, create ? "{\"name\":\"x\"}" : "{\"items\":[]}");
            });
            server.start();
            return server;
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }
}
