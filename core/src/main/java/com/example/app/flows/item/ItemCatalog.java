package com.example.app.flows.item;

import com.example.app.domain.error.UniqueConstraintViolation;
import com.example.app.domain.item.Item;
import com.example.app.domain.item.ItemNameExistsException;
import com.example.app.domain.item.ItemNotFoundException;
import com.example.app.ports.identity.IdGenerator;
import com.example.app.ports.item.ItemRepository;
import com.example.app.ports.time.TimeSource;
import com.example.app.ports.transaction.UnitOfWork;
import java.util.List;
import java.util.UUID;

/**
 * The item use cases. A plain class the composition root constructs; there is no
 * input-port interface in front of it, because one caller per method is not a
 * reason for an abstraction (ADR-005).
 *
 * <p>It owns the decisions a hosting application should not each re-make: where
 * the id and timestamps come from, that a duplicate name is a named conflict
 * rather than a storage error, and that read-then-write is one unit.
 */
public class ItemCatalog {

    private final ItemRepository items;
    private final TimeSource clock;
    private final IdGenerator ids;
    private final UnitOfWork unitOfWork;

    public ItemCatalog(ItemRepository items, TimeSource clock, IdGenerator ids, UnitOfWork unitOfWork) {
        this.items = items;
        this.clock = clock;
        this.ids = ids;
        this.unitOfWork = unitOfWork;
    }

    /** Every item, ordered by name. */
    public List<Item> list() {
        return items.findAll();
    }

    public Item get(UUID id) {
        return items.findById(id).orElseThrow(() -> new ItemNotFoundException(id));
    }

    public Item create(String name, String description) {
        Item item = Item.create(ids.generate(), name, description, clock.now());
        try {
            items.insert(item);
        } catch (UniqueConstraintViolation e) {
            throw new ItemNameExistsException(item.name(), e);
        }
        return item;
    }

    public Item update(UUID id, String name, String description) {
        return unitOfWork.inTransaction(() -> {
            Item revised = get(id).revise(name, description, clock.now());
            try {
                if (!items.update(revised)) {
                    throw new ItemNotFoundException(id);
                }
            } catch (UniqueConstraintViolation e) {
                throw new ItemNameExistsException(revised.name(), e);
            }
            return revised;
        });
    }

    public void delete(UUID id) {
        if (!items.delete(id)) {
            throw new ItemNotFoundException(id);
        }
    }
}
