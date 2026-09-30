package com.example.app.persistence;

import javax.sql.DataSource;
import org.flywaydb.core.Flyway;

/**
 * Owns the Flyway configuration for the operational database, so a composition root
 * that is not Spring Boot and the adapter's own integration tests share one definition
 * with {@code apps/api}, whose autoconfigured Flyway is pointed at the same
 * {@link #LOCATION} by {@code application.yml}.
 *
 * <p>One database, one migration stream, one history table (ADR-021). A new table goes
 * into a new {@code V<n>__*.sql} in the same stream even when it belongs to a different
 * subdomain: a stream is a property of a database, not of a subdomain.
 *
 * <p>No {@code baselineOnMigrate}, deliberately: a baseline would hide a genuinely
 * unexpected non-empty schema instead of failing on it.
 */
public final class OperationalSchema {

    /** Flyway location holding the operational migrations. */
    public static final String LOCATION = "classpath:db/migration";

    /** Flyway history table for the operational schema (Flyway's default name). */
    public static final String HISTORY_TABLE = "flyway_schema_history";

    private OperationalSchema() {}

    /** A Flyway configured for the operational schema over {@code dataSource}. */
    public static Flyway newFlyway(DataSource dataSource) {
        return Flyway.configure()
                .dataSource(dataSource)
                .locations(LOCATION)
                .table(HISTORY_TABLE)
                .load();
    }
}
