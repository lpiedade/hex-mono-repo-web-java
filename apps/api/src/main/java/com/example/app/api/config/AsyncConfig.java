package com.example.app.api.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskDecorator;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * Enables {@code @Async} on Spring Boot's auto-configured task executor, which applies
 * the single {@link TaskDecorator} bean it finds — so every asynchronous task logs under
 * the correlation id of the request that dispatched it (ADR-016).
 *
 * <p>A hand-built executor bypasses that. If you declare one, set
 * {@link MdcTaskDecorator} on it yourself.
 */
@Configuration(proxyBeanMethods = false)
@EnableAsync
public class AsyncConfig {

    @Bean
    public TaskDecorator mdcTaskDecorator() {
        return new MdcTaskDecorator();
    }
}
