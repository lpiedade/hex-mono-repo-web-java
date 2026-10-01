package com.example.app.api.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.MDC;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Binds the authenticated caller's name — the JWT {@code sub}, or the dev-token subject —
 * into the MDC under {@value #MDC_KEY}, so every line logged while serving the request
 * says who asked (ADR-016).
 *
 * <p>Placed in the security chain after authentication and before authorization, so a
 * request refused for lack of a role is attributed too. It does not unbind the key:
 * {@code RequestLogFilter}, outside the chain, still has a line to write, and unbinds it
 * once it has.
 *
 * <p>The subject is an identifier, not a display name: an identity provider's {@code sub}
 * is opaque by design. Configure it to stay that way rather than to carry an e-mail.
 */
public class SubjectMdcFilter extends OncePerRequestFilter {

    /** Printed by {@code logback-spring.xml} as {@code %X{subject}}. */
    public static final String MDC_KEY = "subject";

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null
                && authentication.isAuthenticated()
                && !(authentication instanceof AnonymousAuthenticationToken)) {
            MDC.put(MDC_KEY, authentication.getName());
        }
        filterChain.doFilter(request, response);
    }
}
