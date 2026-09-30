package com.example.app.domain.item;

import com.example.app.domain.error.ApplicationProblem;
import com.example.app.domain.error.ProblemKind;

/** The refusals the item subdomain can answer with, and their stable codes. */
public final class ItemProblems {

    public static final ApplicationProblem ITEM_NOT_FOUND = new ApplicationProblem(
            ProblemKind.NOT_FOUND,
            "ITEM_NOT_FOUND",
            "Not Found",
            "The requested item does not exist.");

    public static final ApplicationProblem ITEM_NAME_EXISTS = new ApplicationProblem(
            ProblemKind.CONFLICT,
            "ITEM_NAME_EXISTS",
            "Conflict",
            "An item with this name already exists.");

    public static final ApplicationProblem ITEM_INVALID = new ApplicationProblem(
            ProblemKind.UNPROCESSABLE,
            "ITEM_INVALID",
            "Unprocessable Entity",
            "The item's values cannot be accepted.");

    private ItemProblems() {
    }
}
