package com.example.app.cli;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

/**
 * The shaded jar as a user runs it, in its own JVM: it starts, answers, and keeps its
 * stdout clean — the contract a script relies on — while a failure goes to stderr with
 * the documented exit code.
 */
class CliJarIT {

    private static final Path JAR = Path.of(System.getProperty("cli.jar", "target/cli.jar"));

    private record Result(int exit, String out, String err) {}

    @Test
    void versionAndHelpAreOnStdoutAlone() throws Exception {
        Result version = run("--version");
        assertThat(version.exit()).isZero();
        assertThat(version.out().strip()).isEqualTo("app 0.1.0-SNAPSHOT");
        assertThat(version.err()).isEmpty();

        Result help = run("items", "--help");
        assertThat(help.exit()).isZero();
        assertThat(help.out()).contains("list").contains("create").contains("delete");
    }

    @Test
    void anUnreachableApiExitsWithItsCodeAndReportsOnStderr() throws Exception {
        Result result = run("items", "list", "--api-url", "http://127.0.0.1:1");

        assertThat(result.exit()).isEqualTo(ExitCodes.UNAVAILABLE);
        assertThat(result.out()).isEmpty();
        assertThat(result.err()).contains("API unreachable");
    }

    private static Result run(String... args) throws IOException, InterruptedException {
        assertThat(Files.isRegularFile(JAR)).as("shaded jar at %s", JAR.toAbsolutePath()).isTrue();
        String java = Path.of(System.getProperty("java.home"), "bin", "java").toString();
        var command = new java.util.ArrayList<>(List.of(java, "-jar", JAR.toString()));
        command.addAll(List.of(args));
        Process process = new ProcessBuilder(command).start();
        assertThat(process.waitFor(60, TimeUnit.SECONDS)).as("the CLI finished").isTrue();
        return new Result(
                process.exitValue(),
                new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8),
                new String(process.getErrorStream().readAllBytes(), StandardCharsets.UTF_8));
    }
}
