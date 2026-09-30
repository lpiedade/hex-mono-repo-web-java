# Developer guides

Operational how-to documentation for developers building and running the
application locally.

Developer guides describe *how* to run, configure, or operate a part of the
system: build commands, test harnesses, container runtimes, and local
environment setup. They do not record decisions: those live in
[`../adr/`](../adr/), and the system design in [`../arch/`](../arch/).

## Documents

| Document | Scope |
| --- | --- |
| [Local verification](local-verification.md) | Running the test suites locally: prerequisites, the commands, browser and accessibility checks, what to do when the container runtime is not found, coverage, and writing an integration test |
| [Building the portal](build-portal.md) | Building `portal/web` and `portal/bff`, running them locally and in containers, and dependency checks |
| [Frontend standards](frontend-standards.md) | How `portal/web` is written — components, hooks, remote state, forms, routing, errors, i18n, accessibility, styling, TypeScript, tests, tooling — its folder layout, and the checklist for adding a feature |

For running the whole stack by hand, see [`infra/README.md`](../../infra/README.md).
