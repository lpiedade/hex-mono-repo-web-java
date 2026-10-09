# Test fixtures

Shared, synthetic datasets for local development and tests. One copy serves
every consumer, so a fixture cannot drift between the script that loads it and
the test that proves it valid.

| Path | Holds | Loaded by |
| --- | --- | --- |
| `dev-data/items.json` | Example items for a fresh local stack | `infra/scripts/seed-dev-data.sh` (and `run-local.sh --seed`); asserted by `apps/api` `DevDataFixtureIT` |

## Rules

- **Load through the application, not around it.** A dataset is sent to the
  API the way a client would send it, so every row passes the contract's and the
  domain's validation. Raw `INSERT`s would let a fixture hold values the
  application itself would refuse, and would bypass whatever the flow does on a
  write (ids, timestamps, uniqueness). `seed-dev-data.sh` posts each entry; a
  `409` means it is already there, so seeding is repeatable.
- **The shipped files are the ones tested.** `DevDataFixtureIT` loads these
  exact files into a real API. A fixture the API would reject fails the build,
  not a developer's first run.
- **Synthetic only.** No production data, no personal data, no real credentials
  — these files are public the moment the repository is.
- **Integration tests own their own data.** An `*IT` creates what it asserts on
  and does not depend on rows another suite left behind (ADR-006). Fixtures here
  are for humans exploring a stack and for proving the fixtures themselves.

## Adding a dataset

1. Put the file under `dev-data/`, one JSON array per resource, each element a
   valid request body of the contract (`apps/api/src/main/openapi/openapi-v1.yaml`).
2. Teach `infra/scripts/seed-dev-data.sh` to post it, in dependency order.
3. Extend `DevDataFixtureIT` to load it.
