package com.example.app.api;

import com.example.app.api.config.AuthProperties;
import com.example.app.api.config.CorsProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

/**
 * Spring Boot composition root for the application API (ADR-007).
 *
 * <p>It owns HTTP routing, serialization, security and Spring wiring, and depends on
 * {@code core} and the adapters. No module depends on it at runtime: the portal declares
 * it in test scope only, to boot it in-process for its real-service suite. Domain logic
 * stays in {@code core} — controllers only translate HTTP to and from application types.
 */
@SpringBootApplication
@EnableConfigurationProperties({AuthProperties.class, CorsProperties.class})
public class AppApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(AppApiApplication.class, args);
    }
}
