package com.example.app.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * The production authentication mode (ADR-011): JWTs are verified, the roles claim —
 * here a nested one — decides what the caller may do, and roles the application does
 * not know grant nothing. The test signs its own tokens with a key pair it generates, and
 * supplies the matching {@link JwtDecoder} bean, which {@code JwtSecurityConfig} prefers
 * over issuer discovery.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"app.auth.mode=jwt", "app.auth.roles-claim=realm_access.roles"})
@Testcontainers(disabledWithoutDocker = true)
class JwtModeIT {

    private static final KeyPair KEYS = generateKeys();

    @TestConfiguration
    static class SigningKeys {

        @Bean
        JwtDecoder jwtDecoder() {
            return NimbusJwtDecoder.withPublicKey((RSAPublicKey) KEYS.getPublic()).build();
        }
    }

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", ApiIntegrationTest.POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", ApiIntegrationTest.POSTGRES::getUsername);
        registry.add("spring.datasource.password", ApiIntegrationTest.POSTGRES::getPassword);
    }

    @Value("${local.server.port}")
    int port;

    private final HttpClient http = HttpClient.newHttpClient();

    @Test
    void aReaderMayReadButNotWrite() throws Exception {
        String token = token("reader@example.com", List.of("READER", "SOMEONE_ELSES_ROLE"));

        assertThat(call("GET", "/api/v1/items", token, null).statusCode()).isEqualTo(200);
        HttpResponse<String> write = call("POST", "/api/v1/items", token, "{\"name\":\"denied\"}");
        assertThat(write.statusCode()).isEqualTo(403);
        assertThat(write.body()).contains("\"code\":\"FORBIDDEN\"");
    }

    @Test
    void anEditorMayWrite() throws Exception {
        String token = token("editor@example.com", List.of("READER", "EDITOR"));

        assertThat(call("POST", "/api/v1/items", token, "{\"name\":\"jwt-" + System.nanoTime() + "\"}")
                .statusCode()).isEqualTo(201);
    }

    @Test
    void theSubjectAndOnlyKnownRolesReachTheUserContext() throws Exception {
        String token = token("reader@example.com", List.of("READER", "SOMEONE_ELSES_ROLE"));

        String body = call("GET", "/api/v1/user-context", token, null).body();

        assertThat(body).contains("\"subject\":\"reader@example.com\"").contains("\"roles\":[\"READER\"]");
    }

    @Test
    void aTokenWithoutRolesIsAuthenticatedButForbidden() throws Exception {
        String token = token("nobody@example.com", List.of());

        assertThat(call("GET", "/api/v1/user-context", token, null).statusCode()).isEqualTo(200);
        assertThat(call("GET", "/api/v1/items", token, null).statusCode()).isEqualTo(403);
    }

    @Test
    void anExpiredOrForeignTokenIsUnauthenticated() throws Exception {
        String expired = token("late@example.com", List.of("READER"), Instant.now().minusSeconds(3600));
        HttpResponse<String> response = call("GET", "/api/v1/items", expired, null);
        assertThat(response.statusCode()).isEqualTo(401);
        assertThat(response.body()).contains("\"code\":\"UNAUTHENTICATED\"");

        assertThat(call("GET", "/api/v1/items", "not-a-jwt", null).statusCode()).isEqualTo(401);
    }

    private HttpResponse<String> call(String method, String path, String token, String body) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Authorization", "Bearer " + token)
                .method(method, body == null
                        ? HttpRequest.BodyPublishers.noBody()
                        : HttpRequest.BodyPublishers.ofString(body));
        if (body != null) {
            request.header("Content-Type", "application/json");
        }
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private static String token(String subject, List<String> roles) {
        return token(subject, roles, Instant.now().plusSeconds(300));
    }

    private static String token(String subject, List<String> roles, Instant expiresAt) {
        RSAKey key = new RSAKey.Builder((RSAPublicKey) KEYS.getPublic())
                .privateKey((RSAPrivateKey) KEYS.getPrivate())
                .keyID("test")
                .build();
        var encoder = new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(key)));
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .subject(subject)
                .issuedAt(expiresAt.minusSeconds(600))
                .expiresAt(expiresAt)
                .claim("realm_access", Map.of("roles", roles))
                .build();
        JwsHeader header = JwsHeader.with(SignatureAlgorithm.RS256).keyId("test").build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    private static KeyPair generateKeys() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            return generator.generateKeyPair();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
