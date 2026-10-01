package com.example.app.portal;

/**
 * Auto-configurations excluded from BFF test contexts.
 *
 * <p>The real-service tests depend on the {@code api} module (test scope) to boot the
 * application API in-process, which puts the API's JDBC and Flyway auto-configuration on
 * the test classpath. The BFF has no database, so without these exclusions its context
 * would try to build a datasource it has no URL for. The co-booted API is a separate
 * context and keeps its own.
 *
 * <p>A test's {@code spring.autoconfigure.exclude} replaces the one in the BFF's
 * {@code application.yml} rather than adding to it, so that file's own exclusion,
 * {@code UserDetailsServiceAutoConfiguration}, is repeated here.
 */
public final class TestAutoConfigurationExclusions {

    /** Comma-separated class names for {@code spring.autoconfigure.exclude}. */
    public static final String VALUE =
            "org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration,"
                    + "org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration,"
                    + "org.springframework.boot.jdbc.autoconfigure.health.DataSourceHealthContributorAutoConfiguration,"
                    + "org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration";

    private TestAutoConfigurationExclusions() {
    }
}
