package com.example.app.flows.item;

import com.example.app.domain.error.UniqueConstraintViolation;
import com.example.app.domain.item.InvalidItemException;
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

    /**
     * A catalog over the given ports.
     *
     * @param items      where items are stored
     * @param clock      the instant every create and update is stamped with
     * @param ids        the identifier of every new item
     * @param unitOfWork the boundary that makes an update's read and write one decision
     */
    public ItemCatalog(ItemRepository items, TimeSource clock, IdGenerator ids, UnitOfWork unitOfWork) {
        this.items = items;
        this.clock = clock;
        this.ids = ids;
        this.unitOfWork = unitOfWork;
    }

    /**
     * Every item, ordered by name.
     *
     * @return every stored item; empty when there are none
     */
    public List<Item> list() {
        return items.findAll();
    }

    /**
     * The item with the given identifier.
     *
     * @param id the identifier to look up
     * @return the item
     * @throws ItemNotFoundException when no item has {@code id}
     */
    public Item get(UUID id) {
        return items.findById(id).orElseThrow(() -> new ItemNotFoundException(id));
    }

    /**
     * Creates an item, taking its identifier and both instants from the ports.
     *
     * @param name        the name; stripped, and required to be non-blank
     * @param description the description; {@code null} or blank for none
     * @return the item as stored
     * @throws InvalidItemException   when a value breaks a rule of {@link Item}
     * @throws ItemNameExistsException when another item already has the name
     */
    public Item create(String name, String description) {
        Item item = Item.create(ids.generate(), name, description, clock.now());
        try {
            items.insert(item);
        } catch (UniqueConstraintViolation e) {
            throw new ItemNameExistsException(item.id(), e);
        }
        return item;
    }

    /**
     * Replaces an item's editable fields, reading it and writing it back in one unit of
     * work so the revision is made against the row it replaces.
     *
     * @param id          the item to change
     * @param name        the new name; stripped, and required to be non-blank
     * @param description the new description; {@code null} or blank removes it
     * @return the item as stored
     * @throws ItemNotFoundException   when no item has {@code id}, including one deleted
     *                                 between the read and the write
     * @throws InvalidItemException    when a value breaks a rule of {@link Item}
     * @throws ItemNameExistsException when another item already has the name
     */
    public Item update(UUID id, String name, String description) {
        return unitOfWork.inTransaction(() -> {
            Item revised = get(id).revise(name, description, clock.now());
            try {
                if (!items.update(revised)) {
                    throw new ItemNotFoundException(id);
                }
            } catch (UniqueConstraintViolation e) {
                throw new ItemNameExistsException(revised.id(), e);
            }
            return revised;
        });
    }

    /**
     * Deletes an item.
     *
     * @param id the item to delete
     * @throws ItemNotFoundException when no item has {@code id}
     */
    public void delete(UUID id) {
        if (!items.delete(id)) {
            throw new ItemNotFoundException(id);
        }
    }
}
