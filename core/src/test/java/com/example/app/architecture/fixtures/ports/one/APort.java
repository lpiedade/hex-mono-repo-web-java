package com.example.app.architecture.fixtures.ports.one;

/**
 * A legitimate Port: an outbound interface, violating nothing. It exists as the thing
 * {@code DomainOne} wrongly reaches for. See the README.
 */
public interface APort {

    String call();
}
