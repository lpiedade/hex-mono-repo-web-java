package com.example.app.architecture.fixtures.domain.one;

import com.example.app.architecture.fixtures.domain.two.DomainTwo;
import com.example.app.architecture.fixtures.ports.one.APort;

/**
 * Plants rule 1 — a {@code domain} class implementing a {@code ports} interface, which is
 * the most common way the rings leak — and half of a {@code domain} cycle for
 * rule 4. See the README.
 */
public final class DomainOne implements APort {

    @Override
    public String call() {
        return DomainTwo.name();
    }
}
