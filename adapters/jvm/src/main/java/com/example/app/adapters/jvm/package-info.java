/**
 * The host JVM as an adapter: the clock, the monotonic counter and UUID generation that
 * {@code core} reaches only through its ports (ADR-015 rule 8). Nothing else belongs here;
 * a homeless implementation is not a reason to add one.
 */
package com.example.app.adapters.jvm;
