package com.example.app.domain.error;

/**
 * A domain refusal that carries the safe {@link ApplicationProblem} an inbound
 * adapter renders — as RFC 9457 Problem Details over HTTP, or as an exit code.
 *
 * <p>Subdomains extend it with a named exception per refusal, so a flow's
 * signature says what it can refuse and the adapter needs one handler for all of
 * them. The message is for logs only and is never sent to a client.
 */
public class ProblemException extends RuntimeException {

    private final transient ApplicationProblem problem;

    /**
     * A refusal described by {@code problem}.
     *
     * @param problem what the adapter renders to the caller
     * @param message what the log records; names entities by id, never by text a client
     *                typed, because it reaches the log verbatim
     */
    public ProblemException(ApplicationProblem problem, String message) {
        super(message);
        this.problem = problem;
    }

    /**
     * The safe description of this refusal, for the inbound adapter to render.
     *
     * @return the problem this exception carries
     */
    public ApplicationProblem problem() {
        return problem;
    }
}
