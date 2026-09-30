package com.example.app.api.security;

import com.example.app.domain.security.AppRole;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/**
 * Turns a validated JWT into an authentication carrying the caller's {@link AppRole}s
 * (ADR-011).
 *
 * <p>The roles claim may be a dotted path into nested claims — {@code roles} for a flat
 * claim, {@code realm_access.roles} for Keycloak. Values that name no {@link AppRole}
 * are ignored rather than granted, so an identity provider that issues extra roles for
 * other applications grants nothing here by accident. Matching is case-sensitive.
 */
final class JwtRolesConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private static final Set<String> KNOWN =
            AppRole.all().stream().map(AppRole::name).collect(Collectors.toUnmodifiableSet());

    private final List<String> claimPath;

    JwtRolesConverter(String rolesClaim) {
        this.claimPath = List.of(rolesClaim.split("\\."));
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        List<SimpleGrantedAuthority> authorities = roleNames(jwt.getClaims()).stream()
                .filter(KNOWN::contains)
                .map(name -> new SimpleGrantedAuthority(AppRole.valueOf(name).authority()))
                .distinct()
                .toList();
        return new JwtAuthenticationToken(jwt, authorities, jwt.getSubject());
    }

    private List<String> roleNames(Map<String, Object> claims) {
        Object node = claims;
        for (String segment : claimPath) {
            if (!(node instanceof Map<?, ?> map)) {
                return List.of();
            }
            node = map.get(segment);
        }
        if (node instanceof Collection<?> values) {
            return values.stream().map(String::valueOf).toList();
        }
        if (node instanceof String single) {
            return List.of(single.split("[\\s,]+"));
        }
        return List.of();
    }
}
