package com.example.app.api.security;

import com.example.app.domain.security.AppRole;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Local-development authentication (ADR-011): validates the pre-shared bearer token and,
 * on a match, authenticates the request as the fixed dev subject with every
 * {@link AppRole}.
 *
 * <p>A missing or malformed {@code Authorization} header, or a wrong token, leaves the
 * request unauthenticated so the authorization filter rejects it with a 401 via the
 * Problem Details entry point. The comparison is constant-time so the token cannot leak
 * through response timing.
 */
public class DevTokenAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final byte[] expectedToken;
    private final String subject;
    private final List<SimpleGrantedAuthority> authorities;

    public DevTokenAuthenticationFilter(String expectedToken, String subject) {
        this.expectedToken = expectedToken.getBytes(StandardCharsets.UTF_8);
        this.subject = subject;
        this.authorities = AppRole.all().stream()
                .map(role -> new SimpleGrantedAuthority(role.authority()))
                .toList();
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.regionMatches(true, 0, BEARER_PREFIX, 0, BEARER_PREFIX.length())) {
            String presented = header.substring(BEARER_PREFIX.length()).trim();
            if (MessageDigest.isEqual(presented.getBytes(StandardCharsets.UTF_8), expectedToken)) {
                authenticate(request);
            }
        }
        filterChain.doFilter(request, response);
    }

    private void authenticate(HttpServletRequest request) {
        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(subject, null, authorities);
        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }
}
