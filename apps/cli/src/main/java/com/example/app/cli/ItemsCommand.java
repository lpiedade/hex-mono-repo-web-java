package com.example.app.cli;

import com.example.app.cli.contract.ApiClient;
import com.example.app.cli.contract.ApiException;
import com.example.app.cli.contract.api.ItemsApi;
import com.example.app.cli.contract.model.Item;
import com.example.app.cli.contract.model.ItemRequest;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.PrintStream;
import java.net.http.HttpClient;
import java.util.UUID;
import java.util.concurrent.Callable;
import picocli.CommandLine.Command;
import picocli.CommandLine.Mixin;
import picocli.CommandLine.Option;
import picocli.CommandLine.Parameters;
import picocli.CommandLine.ParentCommand;

/**
 * {@code app items} — the example resource from the command line, through the generated
 * client (ADR-026). Human-readable output by default, the API's JSON with {@code --json}.
 * Exit codes are {@link ExitCodes}'.
 */
@Command(
        name = "items",
        mixinStandardHelpOptions = true,
        description = "Manage items.",
        subcommands = {
            ItemsCommand.List.class,
            ItemsCommand.Get.class,
            ItemsCommand.Create.class,
            ItemsCommand.Delete.class
        })
public final class ItemsCommand implements Runnable {

    final PrintStream out;
    final PrintStream err;
    final HttpClient.Builder http;

    ItemsCommand() {
        this(System.out, System.err, HttpClient.newBuilder());
    }

    ItemsCommand(PrintStream out, PrintStream err, HttpClient.Builder http) {
        this.out = out;
        this.err = err;
        this.http = http;
    }

    @Override
    public void run() {
        // No subcommand selected — picocli prints help via mixinStandardHelpOptions.
    }

    /** The plumbing every subcommand shares. */
    abstract static class Subcommand implements Callable<Integer> {

        private static final ObjectMapper JSON = ApiClient.createDefaultObjectMapper();

        @ParentCommand
        ItemsCommand parent;

        @Mixin
        ServiceOptions service;

        @Option(names = "--json", description = "Print the API's JSON instead of a summary.")
        boolean json;

        ItemsApi items() {
            return new ItemsApi(service.apiClient(parent.http));
        }

        @Override
        public Integer call() {
            try {
                return run();
            } catch (ApiException e) {
                return ExitCodes.report(e, json, parent.out, parent.err);
            }
        }

        abstract int run() throws ApiException;

        void print(Item item) {
            parent.out.println(json ? toJson(item) : item.getId() + "  " + item.getName());
        }

        static String toJson(Object body) {
            try {
                return JSON.writeValueAsString(body);
            } catch (JsonProcessingException e) {
                throw new IllegalStateException("cannot render " + body.getClass().getSimpleName(), e);
            }
        }

        /**
         * The contract types ids as UUIDs, so a malformed one is refused before a request
         * is sent. Null, after reporting, when {@code value} is not one.
         */
        UUID parseId(String value) {
            try {
                return UUID.fromString(value);
            } catch (IllegalArgumentException e) {
                parent.err.println("[ERROR] '" + value + "' is not an item id");
                return null;
            }
        }
    }

    @Command(name = "list", mixinStandardHelpOptions = true, description = "List every item, by name.")
    static final class List extends Subcommand {

        @Override
        int run() throws ApiException {
            var list = items().listItems();
            if (json) {
                parent.out.println(toJson(list));
            } else {
                list.getItems().forEach(this::print);
            }
            return ExitCodes.OK;
        }
    }

    @Command(name = "get", mixinStandardHelpOptions = true, description = "Show one item.")
    static final class Get extends Subcommand {

        @Parameters(paramLabel = "<itemId>")
        String itemId;

        @Override
        int run() throws ApiException {
            UUID id = parseId(itemId);
            if (id == null) {
                return ExitCodes.INVALID;
            }
            print(items().getItem(id));
            return ExitCodes.OK;
        }
    }

    @Command(name = "create", mixinStandardHelpOptions = true, description = "Create an item.")
    static final class Create extends Subcommand {

        @Parameters(paramLabel = "<name>")
        String name;

        @Option(names = "--description", paramLabel = "<text>")
        String description;

        @Override
        int run() throws ApiException {
            print(items().createItem(new ItemRequest().name(name).description(description)));
            return ExitCodes.OK;
        }
    }

    @Command(name = "delete", mixinStandardHelpOptions = true, description = "Delete an item.")
    static final class Delete extends Subcommand {

        @Parameters(paramLabel = "<itemId>")
        String itemId;

        @Override
        int run() throws ApiException {
            UUID id = parseId(itemId);
            if (id == null) {
                return ExitCodes.INVALID;
            }
            items().deleteItem(id);
            if (!json) {
                parent.out.println("Deleted " + id);
            }
            return ExitCodes.OK;
        }
    }
}
