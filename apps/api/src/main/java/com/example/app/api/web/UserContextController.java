package com.example.app.api.web;

import com.example.app.api.contract.model.SchemaVersion;
import com.example.app.api.contract.model.UserContext;
import com.example.app.domain.security.AppRole;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code GET /api/v1/user-context}: who the caller is and which roles they hold, in the
 * canonical role order. The portal uses it for identity display and role-aware
 * navigation; the API still enforces every rule itself.
 */
@RestController
@RequestMapping("/api/v1")
public class UserContextController {

    @GetMapping(value = "/user-context", produces = MediaType.APPLICATION_JSON_VALUE)
    public UserContext userContext(Authentication authentication) {
        var authorities = authentication.getAuthorities().stream().map(GrantedAuthority::getAuthority).toList();
        var roles = AppRole.fromAuthorities(authorities).stream()
                .map(role -> UserContext.RolesEnum.fromValue(role.name()))
                .toList();
        return new UserContext()
                .schemaVersion(SchemaVersion.NUMBER_1)
                .subject(authentication.getName())
                .roles(roles);
    }
}
