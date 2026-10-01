package com.example.app.domain.error;

/**
 * A write rejected because it would duplicate a value the store keeps unique.
 *
 * <p>Ports declare this instead of letting a persistence framework's own
 * exception reach a flow: a uniqueness clash is a domain outcome that callers
 * routinely translate into a named conflict, and it must stay expressible
 * without Spring, JDBC, or any particular database on the classpath (ADR-003).
 * Adapters translate their vendor's duplicate-key signal into it.
 */
public class UniqueConstraintViolation extends RuntimeException {

    /**
     * A violation with no underlying exception, as a store without a native one reports it.
     *
     * @param message the constraint that was violated, such as {@code item.name}; never the
     *                duplicated value, which may be text a client typed
     */
    public UniqueConstraintViolation(String message) {
        super(message);
    }

    /**
     * A violation translated from the vendor's own duplicate-key signal.
     *
     * @param message the constraint that was violated, as for {@link #UniqueConstraintViolation(String)}
     * @param cause   the vendor's duplicate-key exception, kept for the log
     */
    public UniqueConstraintViolation(String message, Throwable cause) {
        super(message, cause);
    }
}
