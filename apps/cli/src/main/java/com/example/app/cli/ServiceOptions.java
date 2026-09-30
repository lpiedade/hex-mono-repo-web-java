package com.example.app.cli;

import com.example.app.cli.contract.ApiClient;
import java.net.http.HttpClient;
import java.time.Duration;
import picocli.CommandLine.Option;

/**
 * How a command addresses the application API (ADR-026), mixed into every subcommand
 * that calls it.
 */
public final class ServiceOptions {

    static final String DEFAULT_API_URL = "http://localhost:8080";

    /**
     * The contract declares {@code servers: - url: /api/v1}, so the generated client's
     * base URI is that path and the operator supplies only the origin.
     */
    private static final String BASE_PATH = "/api/v1";

    private static final Duration TIMEOUT = Duration.ofSeconds(30);

    @Option(names = "--api-url", paramLabel = "<url>", defaultValue = "${env:APP_API_URL:-" + DEFAULT_API_URL + "}",
            description = "Base URL of the API (env APP_API_URL). Default: ${DEFAULT-VALUE}.")
    public String apiUrl;

    @Option(names = "--token", paramLabel = "<token>", defaultValue = "${env:APP_API_TOKEN}",
            description = "Bearer token presented to the API (env APP_API_TOKEN).")
    public String token;

    public boolean verbose;

    /**
     * Declared on a setter rather than a field so picocli's parse also raises the log
     * levels (ADR-016).
     */
    @Option(names = {"--verbose", "-v"},
            description = "Verbose logging on stderr (application at DEBUG, libraries at INFO).")
    public void verbose(boolean value) {
        this.verbose = value;
        CliLogging.applyVerbose(value);
    }

    /**
     * A client pointed at {@link #apiUrl} and carrying {@link #token}, if one was
     * supplied. The token travels in an interceptor rather than in a field the generated
     * code prints, so nothing in the client's own diagnostics can reveal it.
     */
    public ApiClient apiClient(HttpClient.Builder builder) {
        ApiClient client = new ApiClient(
                builder, ApiClient.createDefaultObjectMapper(), trimTrailingSlash(apiUrl) + BASE_PATH);
        client.setConnectTimeout(TIMEOUT);
        client.setReadTimeout(TIMEOUT);
        if (token != null && !token.isBlank()) {
            client.setRequestInterceptor(request -> request.header("Authorization", "Bearer " + token));
        }
        return client;
    }

    private static String trimTrailingSlash(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
