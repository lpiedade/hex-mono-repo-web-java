package com.example.app.domain.item;

import com.example.app.domain.error.ProblemException;

/**
 * An item value the domain refuses. The contract validates the same limits at
 * the edge; this is the rule that holds whichever adapter the value came from.
 */
public class InvalidItemException extends ProblemException {

    public InvalidItemException(String reason) {
        super(ItemProblems.ITEM_INVALID, reason);
    }
}
