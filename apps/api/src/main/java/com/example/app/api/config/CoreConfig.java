package com.example.app.api.config;

import com.example.app.adapters.jvm.JvmAdapters;
import com.example.app.flows.item.ItemCatalog;
import com.example.app.persistence.ItemRepositoryJdbc;
import com.example.app.persistence.TransactionTemplateUnitOfWork;
import com.example.app.ports.identity.IdGenerator;
import com.example.app.ports.item.ItemRepository;
import com.example.app.ports.time.TimeSource;
import com.example.app.ports.transaction.UnitOfWork;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Binds core's ports to their adapters and constructs the flows (ADR-007). This is the
 * one place that knows which adapter implements which port; {@code core} carries no
 * Spring annotation, so every flow is a {@code @Bean} here rather than a scanned
 * component.
 */
@Configuration(proxyBeanMethods = false)
public class CoreConfig {

    @Bean
    public TimeSource timeSource() {
        return JvmAdapters.systemTimeSource();
    }

    @Bean
    public IdGenerator idGenerator() {
        return JvmAdapters.randomIdGenerator();
    }

    @Bean
    public UnitOfWork unitOfWork(PlatformTransactionManager transactionManager) {
        return new TransactionTemplateUnitOfWork(new TransactionTemplate(transactionManager));
    }

    @Bean
    public ItemRepository itemRepository(JdbcClient jdbcClient) {
        return new ItemRepositoryJdbc(jdbcClient);
    }

    @Bean
    public ItemCatalog itemCatalog(
            ItemRepository items, TimeSource timeSource, IdGenerator idGenerator, UnitOfWork unitOfWork) {
        return new ItemCatalog(items, timeSource, idGenerator, unitOfWork);
    }
}
