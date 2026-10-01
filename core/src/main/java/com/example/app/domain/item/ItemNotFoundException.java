package com.example.app.domain.item;

import com.example.app.domain.error.ProblemException;
import java.util.UUID;

/** No item has the requested identifier. */
public class ItemNotFoundException extends ProblemException {

    /**
     * A refusal answered with {@link ItemProblems#ITEM_NOT_FOUND}.
     *
     * @param id the identifier nothing has
     */
    public ItemNotFoundException(UUID id) {
        super(ItemProblems.ITEM_NOT_FOUND, "item " + id + " not found");
    }
}
