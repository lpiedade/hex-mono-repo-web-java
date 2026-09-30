# Coverage ratchet — the floors the build holds

- Status: Enforced
- Last measured: the template baseline — the example aggregate `items` alone —
  for the Java modules; 2026-09-30 for `portal/web` (§6)
- Commands: `mvn clean verify` (Java), `npm run test:coverage` from `portal/web/`
- Tools: JaCoCo, with unit and integration execution data merged per module;
  Vitest with `@vitest/coverage-v8`
- Decision: [ADR-019](../adr/ADR-019-coverage-ratchet-not-a-target.md)

This file is the single record of every coverage floor and the reading it came
from. The floors themselves live in the build — each module's POM and
`portal/web/vite.config.ts` — and **the two are edited together, in the same
commit, or not at all.**

## 1. What a floor is

A **ratchet, not a target.** Each floor is the last measurement, and no higher.
It answers one question per module — *did this change reduce what the tests
reach?* — against a figure that was observed rather than argued for. There is no
absolute goal, and a reactor-wide figure carries no floor: one module's
improvement must not mask another's regression.

The floors below were measured on the template itself, with only the example
aggregate `items`. They hold from the first commit of a new project: replacing
`items` with real code will move them, and that move is recorded here like any
other.

## 2. Where each floor is enforced

| Surface | Mechanism | Fails |
| --- | --- | --- |
| Java modules | `jacoco:check` (execution `coverage-check`, root POM, bound to `verify`), reading `<coverage.floor.instruction>` and `<coverage.floor.branch>` from the module's POM | `mvn clean verify` |
| `portal/web` | `test.coverage.thresholds` in `portal/web/vite.config.ts` | `npm run test:coverage` (CI runs this, not `npm test`, because Vitest evaluates thresholds only with `--coverage`) |

The Java check reads `target/jacoco.exec`, the **merge** of unit and integration
data, at `BUNDLE` level. Generated contract code (`com/example/app/api/contract/**`,
`com/example/app/cli/contract/**`) and the SPA's generated types are excluded:
their coverage moves with the contract, not the product.

## 3. The floors

### Java modules

| Module | Directory | Instructions floor | Branches floor | Measured at |
| --- | --- | ---: | ---: | --- |
| `core` | `core/` | `0.8671` | `1.0000` | template baseline (398/459 instr., 18/18 branches) |
| `adapter-persistence` | `adapters/persistence/` | `0.9447` | `1.0000` | template baseline (154/163, 4/4) |
| `adapter-jvm` | `adapters/jvm/` | `1.0000` | `0.00` | template baseline (6/6, no branches) |
| `api` | `apps/api/` | `0.8871` | `0.6477` | template baseline (1171/1320, 57/88) |
| `portal` (BFF) | `portal/` | `0.9708` | `0.7777` | template baseline (1134/1168, 56/72) |
| `cli` | `apps/cli/` | `0.8773` | `0.7741` | template baseline (286/326, 24/31) |

### `portal/web`

| Counter | Floor | Measured at |
| --- | ---: | --- |
| Statements | `99.07` | 2026-09-30, on `9496d0a` + the data-router change (2143/2163) |
| Branches | `95.90` | 2026-09-30, on `9496d0a` + the data-router change (515/537) |
| Functions | `94.73` | 2026-09-30, on `9496d0a` + the data-router change (144/152) |
| Lines | `99.07` | 2026-09-30, on `9496d0a` + the data-router change (2143/2163) |

Vitest thresholds are percentages (`0`–`100`); the table uses the same unit as
the config file.

## 4. Taking a reading

```bash
mvn clean verify
```

Per-module HTML reports at `<module>/target/site/jacoco/index.html`, with
`jacoco.csv` beside them. A run without a container runtime is not a valid
reading: the integration suites would not execute, and the build fails rather
than report a figure computed from unit tests alone.

```bash
cd portal/web && npm run test:coverage
```

HTML report at `portal/web/coverage/`, with `coverage/coverage-summary.json` for
scripted comparison.

## 5. Moving a floor

**The floor is the measured ratio truncated, never rounded up and never above the
measurement.** For JaCoCo, truncate to four decimals — `0.7507` from `0.750767` —
because JaCoCo compares at the minimum's own precision. For Vitest, truncate to
two decimals of the percentage — `81.37` from `81.378`.

### Raising one, after coverage improves

In one commit:

1. the new figure in the module's POM (`<coverage.floor.instruction>`,
   `<coverage.floor.branch>`) or in `vite.config.ts`;
2. the same figure in §3, with the date and commit it was measured at.

Raising is expected as test work lands. A ratchet that is never tightened drifts
away from the tree and stops saying anything.

### Lowering one

Possible, explicit, and never silent. In one commit:

1. the new figure in the POM or `vite.config.ts`, taken from a measurement, not
   estimated;
2. the same figure in §3;
3. **the reason**, in §6.

Deleting well-covered code, or adding a thin adapter that is obvious by
inspection, legitimately lowers a ratio without making the product worse. What
is not acceptable is lowering a floor to admit a change that removed tests; the
difference is visible in review, which is why the procedure is a committed diff.

### What is not a way past a floor

- `-DskipITs` skips the check, because a unit-only report understates every
  module; it is a local shortcut, never a CI setting.
- `-Djacoco.skip` also silences the check and is not sanctioned. Moving a floor is
  an edit to a POM and to this file, which is reviewable; a flag passed in a
  terminal is not.

## 6. History

| Date | Commit | Module / counter | From | To | Reason |
| --- | --- | --- | ---: | ---: | --- |
| 2026-09-30 | on `9496d0a` | `portal/web` statements / lines | `98.53` | `99.07` | Raised: route tree, error pages, document title and color-mode provider landed with their suites |
| 2026-09-30 | on `9496d0a` | `portal/web` branches | `95.17` | `95.90` | Raised, same change |
| 2026-09-30 | on `9496d0a` | `portal/web` functions | `93.47` | `94.73` | Raised, same change |
