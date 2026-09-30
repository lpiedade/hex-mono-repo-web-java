package com.example.app.ports.transaction;

import java.util.function.Supplier;

/**
 * Outbound port for running several port calls as one atomic unit.
 *
 * <p>Repository ports are transactional per method, which is enough when one
 * call is one decision. A flow that must read, check, and write together needs a
 * boundary wider than any single call, and declaring it with a framework
 * annotation would put that framework in {@code core}. This port lets the flow
 * state the boundary itself and leaves the mechanism — a transaction template, a
 * connection, a no-op in a unit test — to the adapter.
 *
 * <p>Implementations must roll back when {@code work} throws.
 */
public interface UnitOfWork {

    /** Runs {@code work} atomically and returns its result. */
    <T> T inTransaction(Supplier<T> work);

    /** Runs {@code work} atomically. */
    default void inTransaction(Runnable work) {
        inTransaction(() -> {
            work.run();
            return null;
        });
    }
}
