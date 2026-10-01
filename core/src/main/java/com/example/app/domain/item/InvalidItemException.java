package com.example.app.domain.item;

import com.example.app.domain.error.ProblemException;

/**
 * An item value the domain refuses. The contract validates the same limits at
 * the edge; this is the rule that holds whichever adapter the value came from.
 */
public class InvalidItemException extends ProblemException {

    /**
     * A refusal answered with {@link ItemProblems#ITEM_INVALID}.
     *
     * @param reason which rule the value broke, for the log; it names the rule and the
     *               limit, never the value itself
     */
    public InvalidItemException(String reason) {
        super(ItemProblems.ITEM_INVALID, reason);
    }
}
