package com.example.app.portal.web;

import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * BFF liveness/readiness probe at {@code GET /app/health}. It reports only that the BFF
 * process serves requests and does not probe the API, so orchestration can tell a BFF
 * restart apart from an API outage.
 */
@RestController
public class HealthController {

    @GetMapping(value = "/app/health", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, String> health() {
        return Map.of("status", "UP");
    }
}
