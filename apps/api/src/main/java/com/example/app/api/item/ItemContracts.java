package com.example.app.api.item;

import com.example.app.api.contract.model.ItemList;
import com.example.app.api.contract.model.SchemaVersion;
import com.example.app.domain.item.Item;
import java.time.ZoneOffset;
import java.util.List;

/**
 * Translates between the domain {@link Item} and its contract model at the edge
 * (ADR-012). A generated type never travels below {@code apps/}; this is where the two
 * meet.
 */
final class ItemContracts {

    private ItemContracts() {
    }

    static com.example.app.api.contract.model.Item toContract(Item item) {
        return new com.example.app.api.contract.model.Item()
                .schemaVersion(SchemaVersion.NUMBER_1)
                .id(item.id())
                .name(item.name())
                .description(item.description())
                .createdAt(item.createdAt().atOffset(ZoneOffset.UTC))
                .updatedAt(item.updatedAt().atOffset(ZoneOffset.UTC));
    }

    static ItemList toContract(List<Item> items) {
        return new ItemList()
                .schemaVersion(SchemaVersion.NUMBER_1)
                .items(items.stream().map(ItemContracts::toContract).toList());
    }
}
