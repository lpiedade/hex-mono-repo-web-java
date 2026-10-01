/**
 * The PostgreSQL adapter (ADR-008): explicit SQL through Spring JDBC behind the
 * {@code core} ports, and the Flyway configuration of the schema that SQL assumes
 * ({@link OperationalSchema}, ADR-021). Connectivity — datasource, pool, credentials — is
 * assembled by the composition root and handed in.
 */
package com.example.app.persistence;
