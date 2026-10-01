package com.example.app.api.item;

import com.example.app.api.contract.model.Item;
import com.example.app.api.contract.model.ItemList;
import com.example.app.api.contract.model.ItemRequest;
import com.example.app.flows.item.ItemCatalog;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
 *
 * <p>Every successful write leaves one line on the audit logger {@value #AUDIT_LOGGER}:
 * the event and the item's id. The subject and the correlation id come from the MDC, so
 * the line says who changed what, and joins the request's other lines. Names and
 * descriptions stay out of it — they are text a client typed.
 */
@RestController
@RequestMapping(value = "/api/v1/items", produces = MediaType.APPLICATION_JSON_VALUE)
public class ItemController {

    /** The audit logger's name; its level can be set apart from the application's. */
    public static final String AUDIT_LOGGER = "com.example.app.api.audit";

    private static final Logger audit = LoggerFactory.getLogger(AUDIT_LOGGER);

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
        audit.info("item.created id={}", created.id());
        return ResponseEntity.created(URI.create("/api/v1/items/" + created.id()))
                .body(ItemContracts.toContract(created));
    }

    @GetMapping("/{itemId}")
    public Item get(@PathVariable UUID itemId) {
        return ItemContracts.toContract(catalog.get(itemId));
    }

    @PutMapping(value = "/{itemId}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public Item update(@PathVariable UUID itemId, @Valid @RequestBody ItemRequest request) {
        var updated = catalog.update(itemId, request.getName(), request.getDescription());
        audit.info("item.updated id={}", itemId);
        return ItemContracts.toContract(updated);
    }

    @DeleteMapping("/{itemId}")
    public ResponseEntity<Void> delete(@PathVariable UUID itemId) {
        catalog.delete(itemId);
        audit.info("item.deleted id={}", itemId);
        return ResponseEntity.noContent().build();
    }
}
