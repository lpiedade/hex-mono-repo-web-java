package com.example.app.cli;

import static org.assertj.core.api.Assertions.assertThat;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PrintStream;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import picocli.CommandLine;

/**
 * {@code app items} against a stub API: the requests the generated client sends, what
 * the command prints, and the exit code each answer maps to.
 */
final class ItemsCommandTest {

    private static final String ID = "3f2b1c9e-8a7d-4e6f-9b0a-1c2d3e4f5a6b";
    private static final String ITEM = """
            {"schemaVersion":1,"id":"%s","name":"Widget","createdAt":"2026-01-01T00:00:00Z",\
            "updatedAt":"2026-01-01T00:00:00Z"}""".formatted(ID);

    private HttpServer server;
    private final AtomicInteger status = new AtomicInteger(200);
    private final AtomicReference<String> body = new AtomicReference<>(ITEM);
    private final AtomicReference<String> seenMethod = new AtomicReference<>();
    private final AtomicReference<String> seenPath = new AtomicReference<>();
    private final AtomicReference<String> seenBody = new AtomicReference<>();
    private final AtomicReference<String> seenAuthorization = new AtomicReference<>();

    private final ByteArrayOutputStream out = new ByteArrayOutputStream();
    private final ByteArrayOutputStream err = new ByteArrayOutputStream();

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        server.createContext("/api/v1/items", this::handle);
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    private void handle(HttpExchange exchange) throws IOException {
        seenMethod.set(exchange.getRequestMethod());
        seenPath.set(exchange.getRequestURI().getPath());
        seenBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
        seenAuthorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
        byte[] bytes = body.get().getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        if (status.get() == 204) {
            exchange.sendResponseHeaders(204, -1);
        } else {
            exchange.sendResponseHeaders(status.get(), bytes.length);
            exchange.getResponseBody().write(bytes);
        }
        exchange.close();
    }

    @Test
    void listPrintsOneLinePerItem() {
        body.set("{\"schemaVersion\":1,\"items\":[" + ITEM + "]}");

        assertThat(run("list")).isEqualTo(ExitCodes.OK);
        assertThat(out.toString()).isEqualTo(ID + "  Widget" + System.lineSeparator());
        assertThat(seenMethod.get()).isEqualTo("GET");
    }

    @Test
    void createSendsTheRequestBodyAndTheToken() {
        status.set(201);

        assertThat(run("create", "Widget", "--description", "A thing", "--token", "secret-token"))
                .isEqualTo(ExitCodes.OK);
        assertThat(seenMethod.get()).isEqualTo("POST");
        assertThat(seenBody.get()).contains("\"name\":\"Widget\"").contains("\"description\":\"A thing\"");
        assertThat(seenAuthorization.get()).isEqualTo("Bearer secret-token");
    }

    @Test
    void jsonPrintsTheApisBody() {
        assertThat(run("get", ID, "--json")).isEqualTo(ExitCodes.OK);
        assertThat(out.toString()).contains("\"id\":\"" + ID + "\"").contains("\"name\":\"Widget\"");
        assertThat(seenPath.get()).isEqualTo("/api/v1/items/" + ID);
    }

    @Test
    void deleteReportsWhatItRemoved() {
        status.set(204);
        body.set("");

        assertThat(run("delete", ID)).isEqualTo(ExitCodes.OK);
        assertThat(seenMethod.get()).isEqualTo("DELETE");
        assertThat(out.toString()).contains("Deleted " + ID);
    }

    @Test
    void eachRefusalHasItsOwnExitCode() {
        body.set("{\"code\":\"X\",\"status\":0}");
        status.set(404);
        assertThat(run("get", ID)).isEqualTo(ExitCodes.NOT_FOUND);
        status.set(409);
        assertThat(run("create", "Widget")).isEqualTo(ExitCodes.CONFLICT);
        status.set(400);
        assertThat(run("create", "Widget")).isEqualTo(ExitCodes.INVALID);
        status.set(401);
        assertThat(run("list")).isEqualTo(ExitCodes.DENIED);
        status.set(500);
        assertThat(run("list")).isEqualTo(ExitCodes.UNAVAILABLE);
        assertThat(err.toString()).contains("HTTP 500");
    }

    @Test
    void aProblemBodyReachesStdoutUnderJson() {
        status.set(404);
        body.set("{\"code\":\"ITEM_NOT_FOUND\",\"status\":404}");

        assertThat(run("get", ID, "--json")).isEqualTo(ExitCodes.NOT_FOUND);
        assertThat(out.toString()).contains("ITEM_NOT_FOUND");
    }

    @Test
    void aMalformedIdNeverLeavesTheProcess() {
        assertThat(run("get", "not-a-uuid")).isEqualTo(ExitCodes.INVALID);
        assertThat(run("delete", "not-a-uuid")).isEqualTo(ExitCodes.INVALID);
        assertThat(seenMethod.get()).isNull();
    }

    @Test
    void anUnreachableApiIsUnavailable() {
        server.stop(0);

        assertThat(run("list")).isEqualTo(ExitCodes.UNAVAILABLE);
        assertThat(err.toString()).contains("API unreachable");
    }

    private int run(String... args) {
        String[] withUrl = new String[args.length + 2];
        System.arraycopy(args, 0, withUrl, 0, args.length);
        withUrl[args.length] = "--api-url";
        withUrl[args.length + 1] = "http://localhost:" + server.getAddress().getPort() + "/";
        ItemsCommand command = new ItemsCommand(
                new PrintStream(out, true, StandardCharsets.UTF_8),
                new PrintStream(err, true, StandardCharsets.UTF_8),
                HttpClient.newBuilder());
        return new CommandLine(command).execute(withUrl);
    }
}
