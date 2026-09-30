package com.example.app.cli;

import picocli.CommandLine.Command;

/** The root command. Each resource of the API is a subcommand group. */
@Command(
        name = "app",
        mixinStandardHelpOptions = true,
        version = "app 0.1.0-SNAPSHOT",
        description = "Command-line client of the application API.",
        subcommands = {ItemsCommand.class})
public final class AppCli implements Runnable {

    @Override
    public void run() {
        // No subcommand selected — picocli prints help via mixinStandardHelpOptions.
    }
}
