package com.example.app.domain.item;

import com.example.app.domain.error.ProblemException;
import java.util.UUID;

/**
 * Another item already has the requested name; names are unique.
 *
 * <p>The message names the item by id, never by the name that clashed: the message
 * reaches the logs, and the name is text a client typed.
 */
public class ItemNameExistsException extends ProblemException {

    /**
     * A refusal answered with {@link ItemProblems#ITEM_NAME_EXISTS}.
     *
     * @param id    the item whose name clashed — the new one on create, the edited one on update
     * @param cause the storage failure that reported the clash
     */
    public ItemNameExistsException(UUID id, Throwable cause) {
        super(ItemProblems.ITEM_NAME_EXISTS, "the name of item " + id + " is already taken");
        initCause(cause);
    }
}
