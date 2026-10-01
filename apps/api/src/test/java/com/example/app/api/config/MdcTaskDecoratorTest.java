package com.example.app.api.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

/**
 * Unit tests for {@link MdcTaskDecorator} (ADR-016).
 *
 * <p>Both halves need covering, and the second is the one that bites. Carrying the
 * context across is what makes an {@code @Async} worker log under the right correlation
 * id; <em>restoring</em> the pool thread's previous context is what stops a finished task from
 * stamping the next unrelated one, and a decorator missing that half looks perfectly
 * correct in any single-task test.
 */
class MdcTaskDecoratorTest {

    private final MdcTaskDecorator decorator = new MdcTaskDecorator();

    @AfterEach
    void clearMdc() {
        MDC.clear();
    }

    @Test
    void theSubmittingThreadsContextReachesTheTask() throws Exception {
        AtomicReference<Map<String, String>> seenByTask = new AtomicReference<>();

        // decorate() runs on the submitting thread — this is where the context is captured.
        MDC.put("correlationId", "from-the-request");
        Runnable task = decorator.decorate(() -> seenByTask.set(MDC.getCopyOfContextMap()));
        MDC.clear();

        runOnAnotherThread(task);

        assertThat(seenByTask.get()).containsEntry("correlationId", "from-the-request");
    }

    @Test
    void thePoolThreadsPreviousContextIsRestored() throws Exception {
        MDC.put("correlationId", "task-one");
        Runnable task = decorator.decorate(() -> { });

        AtomicReference<Map<String, String>> afterTask = new AtomicReference<>();
        runOnAnotherThread(() -> {
            // Stand in for a pool thread already carrying an earlier task's context when
            // this one is handed to it.
            MDC.put("correlationId", "left-behind-by-an-earlier-task");
            task.run();
            afterTask.set(MDC.getCopyOfContextMap());
        });

        assertThat(afterTask.get())
                .as("the task must not leak its own context onto the reused thread")
                .containsEntry("correlationId", "left-behind-by-an-earlier-task");
    }

    @Test
    void aTaskSubmittedWithoutAContextDoesNotInheritThePoolThreadsLeftovers() throws Exception {
        AtomicReference<Map<String, String>> seenByTask = new AtomicReference<>();

        MDC.clear();
        Runnable task = decorator.decorate(() -> seenByTask.set(MDC.getCopyOfContextMap()));

        runOnAnotherThread(() -> {
            MDC.put("correlationId", "left-behind-by-an-earlier-task");
            task.run();
        });

        // A schedule tick submits with no correlation id. Logging it under a stale one
        // borrowed from the thread would be worse than logging it under none.
        assertThat(seenByTask.get()).isNullOrEmpty();
    }

    private static void runOnAnotherThread(Runnable runnable) throws InterruptedException {
        Thread thread = new Thread(runnable);
        thread.start();
        thread.join();
    }
}
