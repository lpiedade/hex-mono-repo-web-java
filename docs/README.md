# Documentation

The version-controlled documentation of App. Each subdirectory owns one kind of
document and carries its own `README.md` with the conventions and an index for
that kind. The domain glossary is [`CONTEXT.md`](../CONTEXT.md) at the repository
root.

| Directory | Purpose | Start with |
| --- | --- | --- |
| [`spec/`](spec/) | Functional specifications — what the product must do, and the acceptance evidence a capability requires | [`FS-000-template.md`](spec/FS-000-template.md) |
| [`arch/`](arch/) | Architecture — module map, contracts, data model, security, and design records | [`module-dependency-map.md`](arch/module-dependency-map.md) |
| [`adr/`](adr/) | Architecture Decision Records — significant decisions with their rationale, rejected alternatives and consequences | [`ADR-002`](adr/ADR-002-layered-core-and-apps-boundary.md), the overall style |
| [`plans/`](plans/) | Non-normative delivery planning — feature priority and results, and the order of work | [`feature-register.md`](plans/feature-register.md) |
| [`performance/`](performance/) | Measurements the build or the team relies on — the coverage ratchet first | [`coverage-ratchet.md`](performance/coverage-ratchet.md) |
| [`dev/`](dev/) | Developer guides — building, testing and running the system locally | [`dev/README.md`](dev/README.md) |
| [`assets/`](assets/) | Images that documents and issues embed | [`assets/README.md`](assets/README.md) |

## The contracts

The two OpenAPI documents are the source the build generates from, not
descriptions of it:

- [`arch/api-layer/openapi-v1.yaml`](arch/api-layer/openapi-v1.yaml) — the
  application API (`/api/v1`).
- [`arch/api-layer/portal-api-v1.yaml`](arch/api-layer/portal-api-v1.yaml) — the
  browser-to-BFF surface (`/app/bff/v1`).

## Choosing where a document goes

- Defining observable behaviour or acceptance? [`spec/`](spec/).
- Describing how the system is structured, as it is? [`arch/`](arch/).
- Reasoning about a subsystem before or while building it?
  [`arch/system-design/`](arch/system-design/).
- Recording *why* a decision was made, and what was rejected? [`adr/`](adr/).
- Prioritizing or sequencing already-specified work? [`plans/`](plans/).
- Recording a measurement? [`performance/`](performance/).
- Explaining how a developer builds, runs or operates part of the system?
  [`dev/`](dev/).
- Adding an image a document or an issue embeds? [`assets/`](assets/).
- Defining what a word means? [`CONTEXT.md`](../CONTEXT.md).
