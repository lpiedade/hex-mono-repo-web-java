package com.example.app.ports.item;

import com.example.app.domain.error.UniqueConstraintViolation;
import com.example.app.domain.item.Item;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Outbound port for storing items. Each method is one atomic operation; a flow
 * that needs several to be one decision wraps them in a {@code UnitOfWork}.
 */
public interface ItemRepository {

    Optional<Item> findById(UUID id);

    /** Every item, ordered by name. */
    List<Item> findAll();

    /**
     * Stores a new item.
     *
     * @throws UniqueConstraintViolation when another item already has its name
     */
    void insert(Item item);

    /**
     * Replaces a stored item's fields.
     *
     * @return false when no item has {@code item.id()}
     * @throws UniqueConstraintViolation when another item already has its name
     */
    boolean update(Item item);

    /** @return false when no item has {@code id} */
    boolean delete(UUID id);
}
