package com.example.app.api.item;

import com.example.app.api.contract.model.Item;
import com.example.app.api.contract.model.ItemList;
import com.example.app.api.contract.model.ItemRequest;
import com.example.app.flows.item.ItemCatalog;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/v1/items} — the example resource. Thin by design (ADR-007): it validates
 * the request against the contract, calls the flow, and translates the result. Refusals
 * are {@code ProblemException}s from {@code core}, rendered by {@code ApiExceptionHandler};
 * which role each method needs is declared in {@code ApiAuthorization}.
 */
@RestController
@RequestMapping(value = "/api/v1/items", produces = MediaType.APPLICATION_JSON_VALUE)
public class ItemController {

    private final ItemCatalog catalog;

    public ItemController(ItemCatalog catalog) {
        this.catalog = catalog;
    }

    @GetMapping
    public ItemList list() {
        return ItemContracts.toContract(catalog.list());
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Item> create(@Valid @RequestBody ItemRequest request) {
        var created = catalog.create(request.getName(), request.getDescription());
        return ResponseEntity.created(URI.create("/api/v1/items/" + created.id()))
                .body(ItemContracts.toContract(created));
    }

    @GetMapping("/{itemId}")
    public Item get(@PathVariable UUID itemId) {
        return ItemContracts.toContract(catalog.get(itemId));
    }

    @PutMapping(value = "/{itemId}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public Item update(@PathVariable UUID itemId, @Valid @RequestBody ItemRequest request) {
        return ItemContracts.toContract(catalog.update(itemId, request.getName(), request.getDescription()));
    }

    @DeleteMapping("/{itemId}")
    public ResponseEntity<Void> delete(@PathVariable UUID itemId) {
        catalog.delete(itemId);
        return ResponseEntity.noContent().build();
    }
}
