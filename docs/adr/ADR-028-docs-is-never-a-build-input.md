# ADR-028: `docs/` is never a build input

- Status: Accepted
- Date: 2026-10-09
- Related: [ADR-012](ADR-012-generated-contracts-and-remote-frontend-state.md), [ADR-026](ADR-026-cli-is-a-client-of-the-api.md)

## Context

`.github/workflows/build.yaml` skips the Maven and npm builds for a pull request
whose changed files are all documentation; the credential scan still runs. The
skip is only sound if nothing it matches can change the build's outcome.

The two OpenAPI contracts lived in `docs/arch/api-layer/`, beside the prose that
explains them, and the skip matched `docs/*`. They are not documentation:
`apps/api` generates its models from `openapi-v1.yaml` and serves it, `apps/cli`
generates its client from it, the SPA generates its types from
`portal-api-v1.yaml`, and `ContractPathsAreServedTest`, `BffContractParityTest`
and `apiContract.test.ts` read them. A pull request that changed only a contract
therefore skipped exactly the checks written to catch a contract change, and the
nightly run would have been the first build to see it.

## Decision

- No file under `docs/` is read by the build — not by a POM, an npm script, a
  test, or a Vite import. `docs/` holds prose, diagrams and the images they
  embed.
- A file the build reads lives in the module that owns it:

| File | Owner | Also read by |
| --- | --- | --- |
| `apps/api/src/main/openapi/openapi-v1.yaml` | `apps/api` — generates its models from it, serves it at `/v3/api-docs.yaml` | `apps/cli` (client generation), `portal` (`BffContractParityTest`), `portal-api-v1.yaml` (`$ref`) |
| `portal/bff/src/main/openapi/portal-api-v1.yaml` | `portal/bff` — the surface the BFF serves | `portal/web` (type generation, `apiContract.test.ts`) |

- `src/main/openapi/` is outside Maven's resource roots, so a contract is never
  packaged by accident; `apps/api` copies its own onto the classpath explicitly
  (the `copy-openapi-contract` execution).
- Reading another module's file is not a dependency on that module. `apps/cli`
  still declares no other module, and the enforcer rule that checks it
  ([ADR-026](ADR-026-cli-is-a-client-of-the-api.md)) is unchanged.
- The docs-only skip counts Markdown, `LICENSE` and issue templates as docs, not
  `docs/*`. The rule above is a convention, so the skip does not lean on it: a
  non-Markdown file under `docs/` runs the build.
- Nothing checks the rule mechanically.

## Rationale

A contract belongs to the module whose behaviour it describes. `apps/api` serves
`openapi-v1.yaml` and `ContractPathsAreServedTest` holds it to the controllers;
the BFF serves `portal-api-v1.yaml`. Beside its server, a contract's path says it
is a build input and who owns it, and "change the contract, regenerate, follow
the compiler" stays inside one module for the common case.

Narrowing the skip to Markdown alone would have fixed the CI symptom, but it
would have left the build reading from a directory whose README calls it
documentation. Doing both costs a build on the rare pull request that adds only
an image, and buys a skip that stays sound when the convention slips.

## Alternatives considered

### Leave the contracts in `docs/` and narrow the skip — rejected

Either exclude `docs/arch/api-layer/` from the skip or count only Markdown as
docs. One line in the workflow, and contract changes would build again. It
answers "does this pull request need a build?" and leaves "what is `docs/`?"
open, so the next build input placed there is a judgement call instead of a
mistake.

### A shared top-level `contracts/` directory — rejected

Neutral ground for the four consumers, but it names no owner, and the owner of a
contract is the module that serves it.

### Build in CI without `docs/` — rejected for now

Deleting `docs/` after the credential scan would turn any violation into a red
build, with no pattern to maintain. Rejected for now because the build reads two
files from outside their module, both named above; reopen it if a build input is
found under `docs/` again.

### Grep the build files for `docs/` — rejected

The POMs carry legitimate comments citing `docs/performance/coverage-ratchet.md`,
and the tests built their paths from segments (`Path.of("..", "docs", …)`) that a
textual pattern misses. It would report false positives and miss real reads.

## Consequences

### Positive

- A contract-only pull request runs the Maven and npm builds and every contract
  test.
- Each contract's path names the module that owns it.
- `docs/` can be read, reorganized or moved without consulting the build.

### Negative

- Nothing enforces the rule. A build that reads a Markdown file under `docs/`
  passes CI, and a pull request that changes only that file skips the build;
  review is the only check.
- `apps/cli`, `portal` and `portal-api-v1.yaml` reach into `apps/api`'s source
  tree by relative path (`../api/src/main/openapi/…`,
  `../../../../../apps/api/…`). Moving `apps/api` or its source layout breaks
  them — at build time, not silently.
- The contract design prose (`docs/arch/api-layer/portal-api-v1-bff.md`) is no
  longer beside the YAML it explains; it links to it.
- A pull request that adds only an image under `docs/` runs the full build.
