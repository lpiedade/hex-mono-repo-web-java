package com.example.app.domain.item;

import com.example.app.domain.error.ProblemException;

/** Another item already has the requested name; names are unique. */
public class ItemNameExistsException extends ProblemException {

    public ItemNameExistsException(String name, Throwable cause) {
        super(ItemProblems.ITEM_NAME_EXISTS, "an item named '" + name + "' already exists");
        initCause(cause);
    }
}
