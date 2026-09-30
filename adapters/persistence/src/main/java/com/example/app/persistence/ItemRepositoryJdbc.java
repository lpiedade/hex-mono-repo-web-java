package com.example.app.persistence;

import com.example.app.domain.error.UniqueConstraintViolation;
import com.example.app.domain.item.Item;
import com.example.app.ports.item.ItemRepository;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;

/**
 * {@link ItemRepository} over the {@code item} table (ADR-008): explicit SQL
 * through {@link JdbcClient}, one statement per method, each atomic on its own.
 *
 * <p>Instants are written as {@code timestamptz} through {@link Timestamp} so the
 * driver never interprets them in the JVM's default time zone.
 */
public final class ItemRepositoryJdbc implements ItemRepository {

    private static final String COLUMNS = "id, name, description, created_at, updated_at";

    private final JdbcClient jdbc;

    public ItemRepositoryJdbc(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Optional<Item> findById(UUID id) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM item WHERE id = :id")
                .param("id", id)
                .query(ItemRepositoryJdbc::map)
                .optional();
    }

    @Override
    public List<Item> findAll() {
        return jdbc.sql("SELECT " + COLUMNS + " FROM item ORDER BY name, id")
                .query(ItemRepositoryJdbc::map)
                .list();
    }

    @Override
    public void insert(Item item) {
        try {
            jdbc.sql("INSERT INTO item (" + COLUMNS + ") "
                            + "VALUES (:id, :name, :description, :createdAt, :updatedAt)")
                    .param("id", item.id())
                    .param("name", item.name())
                    .param("description", item.description())
                    .param("createdAt", Timestamp.from(item.createdAt()))
                    .param("updatedAt", Timestamp.from(item.updatedAt()))
                    .update();
        } catch (DuplicateKeyException e) {
            throw new UniqueConstraintViolation("item.name", e);
        }
    }

    @Override
    public boolean update(Item item) {
        try {
            return jdbc.sql("UPDATE item SET name = :name, description = :description, "
                            + "updated_at = :updatedAt WHERE id = :id")
                    .param("id", item.id())
                    .param("name", item.name())
                    .param("description", item.description())
                    .param("updatedAt", Timestamp.from(item.updatedAt()))
                    .update() == 1;
        } catch (DuplicateKeyException e) {
            throw new UniqueConstraintViolation("item.name", e);
        }
    }

    @Override
    public boolean delete(UUID id) {
        return jdbc.sql("DELETE FROM item WHERE id = :id").param("id", id).update() == 1;
    }

    private static Item map(ResultSet row, int rowNumber) throws SQLException {
        return new Item(
                row.getObject("id", UUID.class),
                row.getString("name"),
                row.getString("description"),
                row.getTimestamp("created_at").toInstant(),
                row.getTimestamp("updated_at").toInstant());
    }
}
