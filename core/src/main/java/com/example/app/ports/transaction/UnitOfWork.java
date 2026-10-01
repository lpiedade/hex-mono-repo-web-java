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

    /**
     * Runs {@code work} atomically and returns its result.
     *
     * @param <T>  the type of the result
     * @param work the port calls that make one decision
     * @return what {@code work} returned, once the unit has committed
     */
    <T> T inTransaction(Supplier<T> work);

    /**
     * Runs {@code work} atomically.
     *
     * @param work the port calls that make one decision
     */
    default void inTransaction(Runnable work) {
        inTransaction(() -> {
            work.run();
            return null;
        });
    }
}
