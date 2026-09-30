# core

The application's domain and use cases, with no framework, driver, I/O or
logging dependency (ADR-002, ADR-003, ADR-004, ADR-016). Everything else in the
repository depends on it; it depends on nothing but the JDK.

## Rings

Three package rings under `com.example.app`, each divided by subdomain:

| Ring | Holds | May depend on |
|---|---|---|
| `domain.<subdomain>` | Entities, value objects, enums, domain exceptions, stateless policies | nothing |
| `ports.<subdomain>` | Outbound interfaces (Ports), the records they exchange (Port DTOs), their failures | `domain` |
| `flows.<subdomain>` | Use cases: plain classes that take ports in their constructor | `ports`, `domain` |

The example subdomain is `item`:

- `domain.item.Item` — the aggregate, immutable, valid by construction.
- `domain.item.ItemProblems` and its exceptions — the refusals, each carrying an
  `ApplicationProblem` the inbound adapters render (HTTP status, exit code).
- `ports.item.ItemRepository` — storage, implemented by `adapters/persistence`.
- `flows.item.ItemCatalog` — create, read, list, update, delete.

Shared vocabulary lives in its own subdomains: `domain.error` (problems),
`domain.security` (`AppRole`), `ports.time` (`TimeSource`, `Ticker`),
`ports.identity` (`IdGenerator`), `ports.transaction` (`UnitOfWork`).

## Rules the build enforces

- **No framework or driver** — `maven-enforcer-plugin` bans Spring, JDBC
  drivers, Flyway, ORMs, cloud SDKs and Lombok; `mvn validate` fails (ADR-003).
- **No logging** — neither a logging artifact nor a logging import in
  `src/main`; a flow that has something to report returns it (ADR-016).
- **Rings, cycles, I/O and non-determinism** — seven ArchUnit rules, run nightly
  and on demand with `mvn -Parchitecture verify` (ADR-015). They read bytecode:
  a reference kept only in Javadoc is invisible to them.

## Adding a subdomain

1. `domain.<name>` — the aggregate and its problems.
2. `ports.<name>` — the repository (or other outbound) interface.
3. `flows.<name>` — the use-case class, tested with hand-written fakes of its
   ports (see `ItemCatalogTest`).
4. Wire it in `apps/api` (`CoreConfig`) and implement the port in an adapter.

An input-port interface per use case is not needed: one caller per method is
not a reason for an abstraction (ADR-005).
