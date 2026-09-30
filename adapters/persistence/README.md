# adapters/persistence

PostgreSQL implementations of core's storage ports, with Spring JDBC
(`JdbcClient`) over explicit SQL and a Flyway-owned schema (ADR-008). No JPA, no
Hibernate, no runtime schema generation, and no Spring Boot: wiring is the
composition root's job (`apps/api` `CoreConfig`).

| Class | Role |
|---|---|
| `ItemRepositoryJdbc` | `ports.item.ItemRepository`; translates a duplicate key into `UniqueConstraintViolation` |
| `TransactionTemplateUnitOfWork` | `ports.transaction.UnitOfWork` over a Spring `TransactionTemplate` |
| `OperationalSchema` | The Flyway configuration for the operational database, shared by every consumer |

Migrations live in `src/main/resources/db/migration`; the rules for writing one
are in [`db/CLAUDE.md`](src/main/resources/db/CLAUDE.md) (ADR-021).

## Tests

`ItemPersistenceIT` migrates an empty PostgreSQL Testcontainer and exercises
every repository method, the duplicate-key translation and the unit of work's
rollback. It needs a Docker-compatible runtime; without one it is skipped, and
the root POM fails the build on the skip (ADR-006).

## Adding a repository

1. Declare the port in `core` (`ports.<subdomain>`).
2. Add the table in a new migration.
3. Implement the port here with `JdbcClient`; map rows with a static method and
   translate vendor failures into the port's declared failures.
4. Cover it in an `*IT` against the migrated container.
5. Wire the bean in `apps/api` `CoreConfig`.
