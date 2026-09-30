package com.example.app.flows.item;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.app.domain.error.UniqueConstraintViolation;
import com.example.app.domain.item.Item;
import com.example.app.domain.item.ItemNameExistsException;
import com.example.app.domain.item.ItemNotFoundException;
import com.example.app.ports.item.ItemRepository;
import com.example.app.ports.transaction.UnitOfWork;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Comparator;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;

/**
 * Drives the flow through hand-written fakes of its ports. The clock and the id
 * generator are scripted, which is what the ports exist for (ADR-015 rule 8).
 */
class ItemCatalogTest {

    private static final UUID FIRST = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID SECOND = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final Instant T0 = Instant.parse("2026-01-01T00:00:00Z");
    private static final Instant T1 = Instant.parse("2026-01-02T00:00:00Z");

    private final InMemoryItems store = new InMemoryItems();
    private final Deque<Instant> instants = new ArrayDeque<>(List.of(T0, T1, T1));
    private final Deque<UUID> ids = new ArrayDeque<>(List.of(FIRST, SECOND));
    private final CountingUnitOfWork unitOfWork = new CountingUnitOfWork();
    private final ItemCatalog catalog = new ItemCatalog(store, instants::pop, ids::pop, unitOfWork);

    @Test
    void createTakesItsIdAndTimeFromThePorts() {
        Item created = catalog.create("Widget", "A thing");

        assertThat(created.id()).isEqualTo(FIRST);
        assertThat(created.createdAt()).isEqualTo(T0);
        assertThat(catalog.get(FIRST)).isEqualTo(created);
    }

    @Test
    void aDuplicateNameIsANamedConflict() {
        catalog.create("Widget", null);

        assertThatThrownBy(() -> catalog.create("Widget", null)).isInstanceOf(ItemNameExistsException.class);
    }

    @Test
    void listIsOrderedByName() {
        catalog.create("Zeta", null);
        catalog.create("Alpha", null);

        assertThat(catalog.list()).extracting(Item::name).containsExactly("Alpha", "Zeta");
    }

    @Test
    void updateRevisesInsideOneUnitOfWork() {
        catalog.create("Widget", null);

        Item updated = catalog.update(FIRST, "Gadget", "Renamed");

        assertThat(updated.name()).isEqualTo("Gadget");
        assertThat(updated.createdAt()).isEqualTo(T0);
        assertThat(updated.updatedAt()).isEqualTo(T1);
        assertThat(unitOfWork.units).isEqualTo(1);
        assertThat(catalog.get(FIRST).name()).isEqualTo("Gadget");
    }

    @Test
    void updateToAnotherItemsNameIsANamedConflict() {
        catalog.create("Widget", null);
        catalog.create("Gadget", null);

        assertThatThrownBy(() -> catalog.update(SECOND, "Widget", null))
                .isInstanceOf(ItemNameExistsException.class);
    }

    @Test
    void anUnknownIdIsNotFoundForEveryOperation() {
        assertThatThrownBy(() -> catalog.get(FIRST)).isInstanceOf(ItemNotFoundException.class);
        assertThatThrownBy(() -> catalog.update(FIRST, "Widget", null)).isInstanceOf(ItemNotFoundException.class);
        assertThatThrownBy(() -> catalog.delete(FIRST)).isInstanceOf(ItemNotFoundException.class);
    }

    @Test
    void deleteRemovesTheItem() {
        catalog.create("Widget", null);

        catalog.delete(FIRST);

        assertThat(catalog.list()).isEmpty();
    }

    @Test
    void anItemThatVanishesBetweenReadAndWriteIsNotFound() {
        catalog.create("Widget", null);
        store.loseUpdates = true;

        assertThatThrownBy(() -> catalog.update(FIRST, "Gadget", null)).isInstanceOf(ItemNotFoundException.class);
    }

    private static final class InMemoryItems implements ItemRepository {

        private final Map<UUID, Item> rows = new LinkedHashMap<>();
        boolean loseUpdates;

        @Override
        public Optional<Item> findById(UUID id) {
            return Optional.ofNullable(rows.get(id));
        }

        @Override
        public List<Item> findAll() {
            return rows.values().stream().sorted(Comparator.comparing(Item::name)).toList();
        }

        @Override
        public void insert(Item item) {
            rejectDuplicateName(item);
            rows.put(item.id(), item);
        }

        @Override
        public boolean update(Item item) {
            if (loseUpdates || !rows.containsKey(item.id())) {
                return false;
            }
            rejectDuplicateName(item);
            rows.put(item.id(), item);
            return true;
        }

        @Override
        public boolean delete(UUID id) {
            return rows.remove(id) != null;
        }

        private void rejectDuplicateName(Item item) {
            boolean taken = rows.values().stream()
                    .anyMatch(other -> !other.id().equals(item.id()) && other.name().equals(item.name()));
            if (taken) {
                throw new UniqueConstraintViolation("item.name");
            }
        }
    }

    private static final class CountingUnitOfWork implements UnitOfWork {

        int units;

        @Override
        public <T> T inTransaction(Supplier<T> work) {
            units++;
            return work.get();
        }
    }
}
