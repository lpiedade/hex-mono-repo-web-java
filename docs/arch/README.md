# Architecture

System design and software architecture documentation for App: system context
and boundaries, container and component views, data and execution flows,
integration and deployment architecture, and cross-cutting concerns.

Individual decisions and their rationale live in [`docs/adr/`](../adr/);
[ADR-002](../adr/ADR-002-layered-core-and-apps-boundary.md) is the overall style,
and the place to start.

## The two kinds of document here

**`api-layer/`, `data-layer/`, `security/` and the module map describe the
system as it is.** They are kept current with the tree. The two contracts in
`api-layer/` are not descriptions at all: they are the source the build
generates from, and the tests `ContractPathsAreServedTest` and
`BffContractParityTest` fail when the code and the contract disagree.

**`system-design/` holds design records** — documents written before or while a
subsystem is built, to reason about it. They are not rewritten afterwards to
match whatever was built; each carries a currency note naming where the current
truth lives. See [`system-design/README.md`](system-design/README.md).

## Documents

| Document | Scope |
| --- | --- |
| [Module Dependency Map](module-dependency-map.md) | Maven module graph, runtime communication paths, and enforced architectural constraints |
| [Application API Contract](../../apps/api/src/main/openapi/openapi-v1.yaml) | `openapi-v1.yaml` — the authoritative REST contract (`/api/v1`). The API generates its models and the CLI its client from it; served verbatim at `/v3/api-docs.yaml` |
| [Portal API Contract](../../portal/bff/src/main/openapi/portal-api-v1.yaml) | `portal-api-v1.yaml` — the browser-to-BFF surface (`/app/bff/v1`), referencing the API's schemas |
| [Portal BFF Design](api-layer/portal-api-v1-bff.md) | How the BFF proxies, authenticates, protects against CSRF, and maps errors behind the portal contract |
| [Operational Database — Physical Data Model](data-layer/operational-database-diagram.md) | Entity-relationship diagram, tables, constraints and indexes of the application database |
| [Identity and Authentication](security/identity-and-authentication.md) | The API's `jwt` and `dev-token` modes, the BFF's `oidc` and `dev` modes, roles, and what `GET /user-context` answers |
| [Threat Model](security/threat-model.md) | Template: assets, trust boundaries, threats, controls, and residual risks |
| [System Design Records](system-design/README.md) | What belongs in `system-design/`, and how a design record stays honest |
