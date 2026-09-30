package com.example.app.api.config;

import java.util.Map;
import org.slf4j.MDC;
import org.springframework.core.task.TaskDecorator;

/**
 * Carries the submitting thread's MDC onto the pool thread that runs the task, so work
 * dispatched with {@code @Async} logs the correlation id of the request that started it
 * (ADR-016).
 *
 * <p>{@link #decorate} runs on the submitting thread and the returned {@link Runnable} on
 * the pool thread. Restoring the pool thread's previous context afterwards is not
 * housekeeping: pool threads are reused, so a task that left its context behind would
 * stamp the next unrelated task with its correlation id.
 */
public final class MdcTaskDecorator implements TaskDecorator {

    @Override
    public Runnable decorate(Runnable runnable) {
        Map<String, String> submitted = MDC.getCopyOfContextMap();
        return () -> {
            Map<String, String> previous = MDC.getCopyOfContextMap();
            apply(submitted);
            try {
                runnable.run();
            } finally {
                apply(previous);
            }
        };
    }

    private static void apply(Map<String, String> context) {
        if (context == null) {
            MDC.clear();
        } else {
            MDC.setContextMap(context);
        }
    }
}
