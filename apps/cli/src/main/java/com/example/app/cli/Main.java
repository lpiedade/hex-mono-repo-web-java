package com.example.app.cli;

import picocli.CommandLine;

/** Entry point. Delegates to picocli and exits with the returned code. */
public final class Main {

    private Main() {
    }

    public static void main(String[] args) {
        System.exit(new CommandLine(new AppCli()).execute(args));
    }
}
