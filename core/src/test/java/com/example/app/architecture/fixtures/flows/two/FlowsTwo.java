package com.example.app.architecture.fixtures.flows.two;

import com.example.app.architecture.fixtures.flows.one.FlowsOne;

/** Closes the {@code flows} cycle for rule 4. See the README. */
public final class FlowsTwo {

    private FlowsTwo() {}

    public static String name() {
        return FlowsOne.class.getSimpleName();
    }
}
