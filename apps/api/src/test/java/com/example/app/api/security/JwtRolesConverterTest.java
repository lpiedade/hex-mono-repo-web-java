package com.example.app.api.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

class JwtRolesConverterTest {

    private static Jwt jwt(Map<String, Object> claims) {
        Jwt.Builder builder = Jwt.withTokenValue("t")
                .header("alg", "none")
                .subject("someone")
                .issuedAt(Instant.EPOCH)
                .expiresAt(Instant.EPOCH.plusSeconds(60));
        claims.forEach(builder::claim);
        return builder.build();
    }

    private static List<String> authorities(String claim, Map<String, Object> claims) {
        return new JwtRolesConverter(claim).convert(jwt(claims)).getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .toList();
    }

    @Test
    void readsAFlatListClaim() {
        assertThat(authorities("roles", Map.of("roles", List.of("READER", "EDITOR"))))
                .containsExactly("ROLE_READER", "ROLE_EDITOR");
    }

    @Test
    void walksADottedPath() {
        Map<String, Object> claims = Map.of("realm_access", Map.of("roles", List.of("ADMIN")));

        assertThat(authorities("realm_access.roles", claims)).containsExactly("ROLE_ADMIN");
    }

    @Test
    void acceptsASpaceOrCommaSeparatedString() {
        assertThat(authorities("scope", Map.of("scope", "READER, EDITOR")))
                .containsExactly("ROLE_READER", "ROLE_EDITOR");
    }

    @Test
    void grantsNothingForUnknownRolesOrAMissingClaim() {
        assertThat(authorities("roles", Map.of("roles", List.of("reader", "SUPERUSER")))).isEmpty();
        assertThat(authorities("roles", Map.of("other", "x"))).isEmpty();
        assertThat(authorities("a.b", Map.of("a", "not-a-map"))).isEmpty();
    }

    @Test
    void theNameIsTheSubject() {
        assertThat(new JwtRolesConverter("roles").convert(jwt(Map.of())).getName()).isEqualTo("someone");
    }
}
