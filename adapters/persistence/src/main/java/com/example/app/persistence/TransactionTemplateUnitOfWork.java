package com.example.app.persistence;

import com.example.app.ports.transaction.UnitOfWork;
import java.util.function.Supplier;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Spring implementation of {@link UnitOfWork}. Rollback semantics are the
 * template's own: an unchecked exception escaping {@code work} marks the
 * transaction rollback-only, which is what a flow signalling a domain conflict
 * mid-unit relies on.
 */
public final class TransactionTemplateUnitOfWork implements UnitOfWork {

    private final TransactionTemplate transactionTemplate;

    public TransactionTemplateUnitOfWork(TransactionTemplate transactionTemplate) {
        this.transactionTemplate = transactionTemplate;
    }

    @Override
    public <T> T inTransaction(Supplier<T> work) {
        return transactionTemplate.execute(status -> work.get());
    }
}
