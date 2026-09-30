package com.example.app.portal;

import com.example.app.portal.config.PortalProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

/**
 * Spring Boot composition root for the portal's backend-for-frontend (ADR-009).
 *
 * <p>The browser calls only this same-origin BFF. It owns the browser session and CSRF
 * (ADR-010), forwards {@code /app/bff/v1/*} to the application API's {@code /api/v1/*}
 * with the bearer token attached server-side, and stamps every response with the BFF
 * envelope. It persists nothing and depends on neither {@code core} nor the API at
 * runtime — the API remains the authority for every decision.
 */
@SpringBootApplication
@EnableConfigurationProperties(PortalProperties.class)
public class AppPortalApplication {

    public static void main(String[] args) {
        SpringApplication.run(AppPortalApplication.class, args);
    }
}
