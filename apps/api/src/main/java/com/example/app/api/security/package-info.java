/**
 * Who may call what (ADR-011). One security chain per {@code app.auth.mode} — JWTs from the
 * configured issuer, or a pre-shared dev token — sharing one set of rules
 * ({@code ApiAuthorization}), the Problem Details answers for 401 and 403, and the filter
 * that binds the caller's subject into the MDC (ADR-016).
 */
package com.example.app.api.security;
