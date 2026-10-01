/**
 * The application API: the Spring Boot composition root ({@link AppApiApplication}) that
 * wires {@code core} to its adapters and serves {@code openapi-v1.yaml} over HTTP
 * (ADR-007). The subpackages split it by concern — {@code config}, {@code security},
 * {@code web} — and by resource, one per subdomain ({@code item}).
 */
package com.example.app.api;
