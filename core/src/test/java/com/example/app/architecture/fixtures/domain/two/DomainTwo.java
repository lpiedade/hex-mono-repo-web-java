package com.example.app.architecture.fixtures.domain.two;

import com.example.app.architecture.fixtures.domain.one.DomainOne;

/** Closes the {@code domain} cycle for rule 4. See the README. */
public final class DomainTwo {

    private DomainTwo() {}

    public static String name() {
        return DomainOne.class.getSimpleName();
    }
}
