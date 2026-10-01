package com.example.app.ports.item;

import com.example.app.domain.error.UniqueConstraintViolation;
import com.example.app.domain.item.Item;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Outbound port for storing items. Each method is one atomic operation; a flow
 * that needs several to be one decision wraps them in a
 * {@link com.example.app.ports.transaction.UnitOfWork}.
 */
public interface ItemRepository {

    /**
     * The stored item with the given identifier.
     *
     * @param id the identifier to look up
     * @return the item, or empty when no item has {@code id}
     */
    Optional<Item> findById(UUID id);

    /**
     * Every item, ordered by name.
     *
     * @return every stored item; empty when there are none
     */
    List<Item> findAll();

    /**
     * Stores a new item.
     *
     * @param item the item to store, with the identifier and instants the flow assigned
     * @throws UniqueConstraintViolation when another item already has its name
     */
    void insert(Item item);

    /**
     * Replaces a stored item's fields.
     *
     * @param item the revised item; its identifier selects the row it replaces
     * @return false when no item has {@code item.id()}
     * @throws UniqueConstraintViolation when another item already has its name
     */
    boolean update(Item item);

    /**
     * Removes an item.
     *
     * @param id the identifier of the item to remove
     * @return false when no item has {@code id}
     */
    boolean delete(UUID id);
}
