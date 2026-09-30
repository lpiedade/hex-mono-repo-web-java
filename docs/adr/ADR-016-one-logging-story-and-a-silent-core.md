# ADR-016: One logging story, and a silent `core`

- Status: Accepted
- Date: Template baseline
- Related: ADR-002, ADR-003, ADR-004, ADR-007, ADR-009, ADR-015, ADR-026

## Context

A multi-module Java build acquires a logging facade per module unless one is
chosen. The JDK offers two (`System.Logger`, `java.util.logging`), Spring Boot
brings slf4j and logback transitively through `spring-boot-starter-logging`, and
a CLI tends to write through `System.out` and `System.err`. Each works in
isolation. Together they fail in ways that cost more than the inconsistency:

- **A correlation id that is written and never read.** The API and the BFF bind
  a `correlationId` into the slf4j MDC on every request, and return it in the
  response header and the Problem Details body so a client can tie an error to
  server-side logs. Spring Boot's default pattern prints no MDC, so without a
  committed pattern the id reaches every response and no log line. The MDC is
  also thread-local, so `@Async` work drops it regardless.
- **Libraries choosing their own fallback.** In a shaded CLI jar with no slf4j
  binding, Flyway and `spring-jcl` fall back to `java.util.logging` and write
  two-line console records to stderr, interleaved with the CLI's own output and
  unconfigurable. `System.Logger` calls from `core` land on the same default
  handler.
- **Levels that cannot be reached.** `System.Logger` output reaches logback only
  through `java.util.logging` and a bridge handler, and JUL's own level gate
  sits in front of logback's. A DEBUG line behind that gate is unreachable from
  the deployment's log configuration.

Two things that look like logging are not, and are worth naming so they are not
"fixed": `java.util.logging.Logger` is the return type JDBC dictates for
`DataSource.getParentLogger()`, and a CLI's `PrintStream` for stdout is its
output contract ([ADR-026](ADR-026-cli-is-a-client-of-the-api.md)).

The question is where the one facade lives. `core` is the reason it is not
trivial: it has zero main-scope dependencies, deliberately, and
`maven-enforcer-plugin` defends that
([ADR-003](ADR-003-core-dependency-exclusions.md)).

## Decision

**`core` writes no logs at all. Every other module uses slf4j, with logback as
the only backend.**

`core` is silent, not quiet by convention. A flow that observes something worth
reporting **returns it**, and the application hosting the flow decides how to
report it. A hypothetical `PurgeExpiredItemsFlow` returns a result record naming
what it purged, what it skipped and why, and each per-item failure with the
`Exception` itself, so the caller can log the stack trace. A flow run on a
schedule also does not catch its own failures to keep the scheduler alive:
surviving a failed tick is a property of the schedule, so the scheduling code in
the app catches.

Everywhere else:

- **Libraries** (`adapters/*`) declare `org.slf4j:slf4j-api` and no binding. An
  adapter must be able to name a logger; choosing where the output goes is not
  its call.
- **Apps** (`apps/api`, `apps/cli`, `portal`) declare the binding, because a
  composition root is the one place allowed to know its backend.
- `System.Logger` and `java.util.logging` are not used for logging anywhere.
  `java.util.logging.Logger` appears only as the return type of
  `DataSource.getParentLogger()`.

The format is committed, self-contained, and prints the MDC:

- `apps/api` and `portal/bff` each carry a `logback-spring.xml` whose pattern
  includes `[%X{correlationId:--}]`, defaulting to `-` so a line emitted outside
  any request still has the field and stays parseable by column. Both include
  none of Boot's logback defaults, so the format does not move when Boot does.
  Both patterns have the same shape, because the same id crosses both processes
  and a shared field is what lets one query join a BFF line to the API line it
  provoked.
- Every `ThreadPoolTaskExecutor` that runs `@Async` work carries
  `MdcTaskDecorator`, so that work logs under the correlation id of the request
  that started it. The decorator restores the pool thread's previous context
  afterwards: pool threads are reused, and a task that left its context behind
  would stamp the next unrelated task.
- `apps/cli` carries a `logback.xml` — not `logback-spring.xml`; there is no
  Spring context — that sends **every** log line to `System.err` with the root
  at `WARN`. The CLI's stdout is a contract its `*IT` suites assert on, so no
  library may write to it.
- `application.yml` carries levels and nothing else. Raising the application's
  own packages is a separate logger level from the root, because raising the
  root to DEBUG also raises Spring, Hikari and Flyway and buries the lines an
  operator is chasing.

Two enforcement layers guard `core`'s silence, because neither sees the whole
rule:

- `bannedDependencies` includes `org.slf4j:*`, `ch.qos.logback:*`,
  `org.apache.logging.log4j:*` and `commons-logging:*`, scoped to `compile` and
  `runtime`. This catches a logging library arriving as a dependency,
  transitively included.
- A `maven-antrun-plugin` check bound to `validate` fails the build if
  `core/src/main/java` matches a logging API — `System.getLogger`,
  `System.Logger`, `java.util.logging`, `org.slf4j`, `org.apache.logging`, or
  `System.out` / `System.err`. The JDK packages cannot be banned by any
  dependency rule: a stray `System.getLogger` would compile and ship, and its
  output would land on whatever handler the host happened to have. This is the
  same blind spot [ADR-004](ADR-004-core-touches-no-io.md) has with
  `java.nio.file`, and the same remedy.

The dependency ban is scoped to `compile` and `runtime` because what this record
forbids is a logging call in code `core` ships. A facade on the test classpath
ships nothing, and [ADR-015](ADR-015-archunit-nightly-ring-report.md)'s
`archunit` artifact depends on `slf4j-api`; an all-scope ban would fail
`mvn validate` on it.

This source check is ADR-015's **rule 7**. It lives here, not in ArchUnit, and
the number is left as a gap in that record's set.

### Why this source check gates when ArchUnit does not

[ADR-015](ADR-015-archunit-nightly-ring-report.md) holds that ArchUnit "is an
instrument, not a gate", and splits jurisdiction as "a ring is ArchUnit's; a
layer is the enforcer's and the POM's". A source check that fails `validate`
needs a reason not to be a nightly report instead.

The reason is that this is neither a ring nor a module layer. It is one literal
prohibition — no logging API in `core/src/main` — with a fixed, enumerable
pattern set, no package-graph reasoning, and no judgement about which ring may
see which. ADR-015 declines to gate because a ring rule is a design opinion that
may legitimately need renegotiating, and a red build is the wrong place to hold
that argument. This rule is closer to ADR-003's banned dependencies, which do
gate: it catches a typo-scale mistake whose consequence is silent, and it is
expressed against source rather than the POM only because the offending API
happens to ship with the JDK.

If that distinction proves too fine — if the team would rather every
source-level architectural check be an instrument — the antrun execution moves
into ADR-015's nightly report as rule 7. The dependency half of the ban stands
either way, since that half is unambiguously the enforcer's.

## Alternatives considered

### `slf4j-api` in `core` too, for one uniform facade — rejected

The obvious answer and the cheapest to describe: one API in every module, one
rule to teach, and the MDC available inside the flows. `slf4j-api` is a pure
facade with no transitive dependencies, and nothing in ADR-003's ban list
would otherwise cover it.

Rejected because it spends the property that makes `core` worth defending for a
convenience the caller can supply. Zero main-scope dependencies is what makes
the module reusable in a process whose logging stack nobody has chosen yet, and
it is a claim verified by reading one `pom.xml` rather than by auditing a list
of permitted exceptions. Once one facade is admitted, the argument against the
next zero-transitive, obviously harmless library is only a matter of degree.

The convenience is also smaller than it looks. What a flow would log is
information it already has and its caller already wants; returning it lets a
unit test assert an observation — "this was surfaced and not acted on" — that a
log line would leave reachable by no test at all.

### `System.Logger` everywhere, bridged by `slf4j-jdk-platform-logging` — rejected

Symmetric to the above and initially attractive: `core` keeps zero
dependencies, every module calls the JDK facade, and a `LoggerFinder` on each
app's runtime classpath routes `System.Logger` into logback with the MDC intact.

Rejected because correct behaviour then depends on a runtime service
registration that fails silently. Drop the bridge from one app's classpath, or
lose the `META-INF/services` entry in a repackaging, and nothing breaks:
`System.Logger` falls back to `java.util.logging`, and logs keep flowing to a
different place in a different format with the MDC gone. That is the failure
this record exists to end, reintroduced as a packaging detail. It also asks
every author to write `LOG.log(System.Logger.Level.WARNING, "...{0}...", arg)`
where slf4j offers `log.warn("...{}...", arg)`.

### Keep both facades and fix only the configuration — rejected

The minimal option: commit the logback files and the level blocks, and leave
`core` on `System.Logger`. It fixes the correlation id and the CLI's stderr with
no signature changes.

Rejected because it leaves the boundary undefended and the level defect latent:
without a bridge, `core`'s output reaches logback through JUL, whose own gate
makes some levels unreachable from any logback setting. "`core` uses a different
facade, configured somewhere else, at levels that partly do not work" is not a
story worth writing down.

## Consequences

### Positive

- The correlation id reaches the logs in both services, on request threads and
  on `@Async` threads, so a Problem Details `correlationId` is actionable.
- `core` has an invariant that is checked rather than remembered, and keeps
  zero main-scope dependencies.
- An operational event a flow observes is a typed value a unit test can assert,
  not log text.
- The CLI's stdout is guaranteed clean: one configuration file states that every
  log line goes to stderr, replacing each library's independent default.
- One committed format in both services, parseable by column.

### Negative

- A returned result that a caller may ignore is weaker enforcement than a log
  call the compiler cannot omit: nothing makes the scheduling code actually
  report what a flow returned.
- Reporting sits further from the code that observes it. The reason is decided
  in the flow and phrased in the app, so the two can drift.
- Each new operational event in `core` costs a field on a result record and a
  line in the caller, rather than one log statement. That is the intended
  price, and it will feel like friction the first time someone wants a quick
  DEBUG line inside a flow.
- The self-contained logback files trade Boot's evolving defaults for a format
  this repository owns: colour output is gone, and a future Boot improvement to
  the default pattern will not arrive on its own.
- The committed format is a text pattern, not structured logs. Moving to
  structured output is a different encoder in the two `logback-spring.xml`
  files plus further MDC keys beside `correlationId`; it is deferred until a log
  consumer actually requires it.
