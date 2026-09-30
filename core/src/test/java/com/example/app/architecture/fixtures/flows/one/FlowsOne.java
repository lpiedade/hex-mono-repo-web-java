package com.example.app.architecture.fixtures.flows.one;

import com.example.app.architecture.fixtures.flows.two.FlowsTwo;

/** Plants half of a {@code flows} cycle for rule 4. See the README. */
public final class FlowsOne {

    private FlowsOne() {}

    public static String name() {
        return FlowsTwo.class.getSimpleName();
    }
}
