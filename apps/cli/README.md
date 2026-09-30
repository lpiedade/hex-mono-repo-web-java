# apps/cli

A command-line client of the application API (ADR-026). It reaches the
application only over HTTP, through a client generated from
`docs/arch/api-layer/openapi-v1.yaml`, and declares no other module of this
repository — the enforcer fails `mvn validate` if it does.

```bash
mvn -pl apps/cli -am package
java -jar apps/cli/target/cli-0.1.0-SNAPSHOT.jar items list --api-url http://localhost:8080 --token "$(cat .run/dev-token)"
java -jar apps/cli/target/cli-0.1.0-SNAPSHOT.jar items create "Widget" --description "A thing"
```

`--api-url` and `--token` default to `APP_API_URL` and `APP_API_TOKEN`. `--json`
prints the API's body instead of a summary; `--verbose` raises logging, on
stderr.

## Contract with scripts

- **stdout carries only the command's output.** Every log line goes to stderr
  (`logback.xml`, root at WARN), so output can be piped (ADR-016).
- **Exit codes** name the kind of answer — see `ExitCodes`: 0 success,
  2 invalid, 3 not found, 4 conflict, 5 not authenticated or not allowed,
  6 API unreachable or unexpected answer.

## Adding a command

Add the operation to the contract first; the build regenerates the client.
Then add a subcommand under the resource's command group (see `ItemsCommand`),
map refusals through `ExitCodes.report`, and test it against a stub
`HttpServer` (see `ItemsCommandTest`).
