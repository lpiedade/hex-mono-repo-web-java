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

    public ProblemException(ApplicationProblem problem, String message) {
        super(message);
        this.problem = problem;
    }

    public ApplicationProblem problem() {
        return problem;
    }
}
