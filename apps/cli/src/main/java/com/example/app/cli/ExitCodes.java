package com.example.app.cli;

import com.example.app.cli.contract.ApiException;
import java.io.PrintStream;

/**
 * The CLI's exit codes, one per kind of answer the API can give, so a script can branch
 * on the result without parsing text. Keep this table and the one in
 * {@code apps/cli/README.md} in step.
 *
 * <ul>
 *   <li>0 — success</li>
 *   <li>2 — the request is invalid (400, 422, or refused before it was sent)</li>
 *   <li>3 — not found (404)</li>
 *   <li>4 — conflict with the current state (409)</li>
 *   <li>5 — not authenticated or not allowed (401, 403)</li>
 *   <li>6 — the API could not be reached, or answered something unexpected</li>
 * </ul>
 */
final class ExitCodes {

    static final int OK = 0;
    static final int INVALID = 2;
    static final int NOT_FOUND = 3;
    static final int CONFLICT = 4;
    static final int DENIED = 5;
    static final int UNAVAILABLE = 6;

    private ExitCodes() {
    }

    /**
     * Reports an {@link ApiException} on stderr and returns its exit code. The API's
     * Problem Details body goes to stdout under {@code --json}, where a script reads it.
     * Code {@code 0} is how the generated client signals a transport failure.
     */
    static int report(ApiException e, boolean json, PrintStream out, PrintStream err) {
        if (json && e.getResponseBody() != null) {
            out.println(e.getResponseBody());
        }
        int exit = switch (e.getCode()) {
            case 400, 422 -> INVALID;
            case 401, 403 -> DENIED;
            case 404 -> NOT_FOUND;
            case 409 -> CONFLICT;
            default -> UNAVAILABLE;
        };
        err.println("[ERROR] " + (e.getCode() == 0 ? "API unreachable: " + e.getMessage() : "HTTP " + e.getCode()));
        return exit;
    }
}
