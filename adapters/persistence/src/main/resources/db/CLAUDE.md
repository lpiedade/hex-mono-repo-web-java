## Flyway migrations — non-negotiable rules

Flyway exclusively owns the schema. There is no runtime DDL and no JPA schema
generation: `grep -rn "CREATE TABLE" --include=*.java` over `src/main` returns
nothing, and it stays that way (ADR-008).

| Stream | Location | History table | Database | Applied by |
|---|---|---|---|---|
| migration | `db/migration/` | `flyway_schema_history` | operational | Boot's autoconfigured Flyway in `apps/api`; `OperationalSchema` everywhere else |

**A stream is a property of a database, not of a subdomain** (ADR-021). Do not
add a second stream to separate tables that share a datasource. A second stream
appears only with a second database, and then gets its own location, history
table and `*Schema` class beside `OperationalSchema`.

### Writing a migration

- **Never edit a migration that has shipped.** Flyway checksums every applied
  file; editing one breaks every database that already ran it. Fix forward with
  a new `V<n>__*.sql`.
- **Name it for what it does**: `V2__item_add_owner.sql`, not `V2__changes.sql`.
  Numbers are sequential integers; take the next one, and re-number before
  merging if another branch took it first.
- **One concern per file.** A migration is reviewed and rolled forward as a
  unit; mixing unrelated changes makes both harder.
- **Constraints belong in the schema too.** A uniqueness or check the domain
  relies on is also declared in SQL (see `item_name_unique`), and the adapter
  translates its violation into the domain's type (`UniqueConstraintViolation`).
- **Think about the table's size before locking it.** `CREATE INDEX
  CONCURRENTLY`, a nullable column first and a backfill after, or a new table
  and a copy — whatever keeps a large table writable. Flyway runs each file in a
  transaction by default, and `CONCURRENTLY` cannot run in one: put it in its
  own file with `-- flyway:executeInTransaction=false`.

### Verifying

`ItemPersistenceIT` migrates an empty PostgreSQL from scratch through
`OperationalSchema.newFlyway(...)`, so a migration that does not apply fails the
adapter's build. Every `apps/api` `*IT` migrates again at startup. There is no
separate "migrate" step to remember.

If a change needs data to move between databases, or cannot be expressed as a
forward-only migration, STOP and ask: that needs an ordering decision, not a
migration.
