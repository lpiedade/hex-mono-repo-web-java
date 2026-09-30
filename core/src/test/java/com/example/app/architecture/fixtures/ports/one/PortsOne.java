package com.example.app.architecture.fixtures.ports.one;

import com.example.app.architecture.fixtures.ports.two.PortsTwo;

/**
 * Plants rule 5 — a class in the {@code ports} ring that is none of the three things that
 * ring holds: not an outbound interface, not a record, not an exception — and half of a
 * {@code ports} cycle for rule 4. See the README.
 */
public final class PortsOne {

    private PortsOne() {}

    public static String name() {
        return PortsTwo.class.getSimpleName();
    }
}
