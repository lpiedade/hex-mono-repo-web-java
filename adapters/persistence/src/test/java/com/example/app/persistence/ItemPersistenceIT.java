package com.example.app.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.app.domain.error.UniqueConstraintViolation;
import com.example.app.domain.item.Item;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.postgresql.ds.PGSimpleDataSource;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * The item repository and the unit of work against a real PostgreSQL migrated from
 * empty by {@link OperationalSchema} (ADR-006, ADR-021).
 */
@Testcontainers(disabledWithoutDocker = true)
class ItemPersistenceIT {

    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17-alpine");

    // Microseconds: PostgreSQL timestamptz does not keep nanoseconds, so a round trip of
    // Instant.now() would not compare equal.
    private static final Instant T0 = Instant.parse("2026-01-01T10:15:30.123456Z");
    private static final Instant T1 = T0.plus(1, ChronoUnit.DAYS);

    private static PGSimpleDataSource dataSource;
    private static JdbcClient jdbc;
    private ItemRepositoryJdbc items;

    @BeforeAll
    static void migrate() {
        dataSource = new PGSimpleDataSource();
        dataSource.setUrl(POSTGRES.getJdbcUrl());
        dataSource.setUser(POSTGRES.getUsername());
        dataSource.setPassword(POSTGRES.getPassword());
        OperationalSchema.newFlyway(dataSource).migrate();
        jdbc = JdbcClient.create(dataSource);
    }

    @BeforeEach
    void emptyTheTable() {
        jdbc.sql("DELETE FROM item").update();
        items = new ItemRepositoryJdbc(jdbc);
    }

    @Test
    void anInsertedItemReadsBackUnchanged() {
        Item item = Item.create(UUID.randomUUID(), "Widget", "A thing", T0);

        items.insert(item);

        assertThat(items.findById(item.id())).contains(item);
    }

    @Test
    void findAllIsOrderedByName() {
        items.insert(Item.create(UUID.randomUUID(), "Zeta", null, T0));
        items.insert(Item.create(UUID.randomUUID(), "Alpha", null, T0));

        assertThat(items.findAll()).extracting(Item::name).containsExactly("Alpha", "Zeta");
    }

    @Test
    void aDuplicateNameIsTranslatedToTheDomainViolation() {
        items.insert(Item.create(UUID.randomUUID(), "Widget", null, T0));
        Item twin = Item.create(UUID.randomUUID(), "Widget", null, T0);

        assertThatThrownBy(() -> items.insert(twin)).isInstanceOf(UniqueConstraintViolation.class);
    }

    @Test
    void updateReplacesTheEditableFieldsAndReportsAMissingRow() {
        Item item = Item.create(UUID.randomUUID(), "Widget", null, T0);
        items.insert(item);

        Item revised = item.revise("Gadget", "Renamed", T1);
        assertThat(items.update(revised)).isTrue();
        assertThat(items.findById(item.id())).contains(revised);

        Item ghost = Item.create(UUID.randomUUID(), "Ghost", null, T0);
        assertThat(items.update(ghost)).isFalse();
    }

    @Test
    void updateToATakenNameIsTranslatedToTheDomainViolation() {
        items.insert(Item.create(UUID.randomUUID(), "Widget", null, T0));
        Item gadget = Item.create(UUID.randomUUID(), "Gadget", null, T0);
        items.insert(gadget);

        assertThatThrownBy(() -> items.update(gadget.revise("Widget", null, T1)))
                .isInstanceOf(UniqueConstraintViolation.class);
    }

    @Test
    void deleteReportsWhetherARowWentAway() {
        Item item = Item.create(UUID.randomUUID(), "Widget", null, T0);
        items.insert(item);

        assertThat(items.delete(item.id())).isTrue();
        assertThat(items.delete(item.id())).isFalse();
        assertThat(items.findById(item.id())).isEmpty();
    }

    @Test
    void theUnitOfWorkRollsBackWhenTheWorkThrows() {
        var unitOfWork = new TransactionTemplateUnitOfWork(
                new TransactionTemplate(new DataSourceTransactionManager(dataSource)));

        assertThatThrownBy(() -> unitOfWork.inTransaction(() -> {
            items.insert(Item.create(UUID.randomUUID(), "Widget", null, T0));
            throw new IllegalStateException("abandon the unit");
        })).isInstanceOf(IllegalStateException.class);

        assertThat(items.findAll()).isEmpty();
    }
}
