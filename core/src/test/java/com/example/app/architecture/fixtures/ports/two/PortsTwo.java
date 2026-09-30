package com.example.app.architecture.fixtures.ports.two;

import com.example.app.architecture.fixtures.flows.one.FlowsOne;
import com.example.app.architecture.fixtures.ports.one.PortsOne;

/**
 * Plants rule 2 — the {@code ports} ring depending on {@code flows} — and closes the
 * {@code ports} cycle for rule 4. See the README.
 */
public final class PortsTwo {

    private PortsTwo() {}

    public static String reachOutwards() {
        return FlowsOne.name() + PortsOne.name();
    }
}
