/**
 * The command-line client of the application API (ADR-026): picocli commands over a client
 * generated from {@code openapi-v1.yaml}. It depends on no other module and reaches the
 * application only over HTTP. Its stdout is a contract a script reads — output, and the
 * API's JSON under {@code --json} — so every log line goes to stderr (ADR-016), and each
 * kind of answer has its own exit code ({@link ExitCodes}).
 */
package com.example.app.cli;
