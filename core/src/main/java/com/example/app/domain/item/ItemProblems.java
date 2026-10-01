package com.example.app.domain.item;

import com.example.app.domain.error.ApplicationProblem;
import com.example.app.domain.error.ProblemKind;

/** The refusals the item subdomain can answer with, and their stable codes. */
public final class ItemProblems {

    /** No item has the requested identifier ({@link ItemNotFoundException}). */
    public static final ApplicationProblem ITEM_NOT_FOUND = new ApplicationProblem(
            ProblemKind.NOT_FOUND,
            "ITEM_NOT_FOUND",
            "Not Found",
            "The requested item does not exist.");

    /** Another item already has the name ({@link ItemNameExistsException}). */
    public static final ApplicationProblem ITEM_NAME_EXISTS = new ApplicationProblem(
            ProblemKind.CONFLICT,
            "ITEM_NAME_EXISTS",
            "Conflict",
            "An item with this name already exists.");

    /**
     * A value passed the contract but not the domain, such as a name that is blank once
     * stripped ({@link InvalidItemException}).
     */
    public static final ApplicationProblem ITEM_INVALID = new ApplicationProblem(
            ProblemKind.UNPROCESSABLE,
            "ITEM_INVALID",
            "Unprocessable Entity",
            "The item's values cannot be accepted.");

    private ItemProblems() {
    }
}
