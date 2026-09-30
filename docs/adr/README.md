# Architecture Decision Records

This directory holds the Architecture Decision Records (ADRs) of App: the
significant technical and architectural decisions, why they were made, what was
rejected, and what they cost. [ADR-002](ADR-002-layered-core-and-apps-boundary.md)
records the overall style; start there.

Write an ADR when a decision:

- affects system structure or module boundaries;
- introduces or replaces a technology;
- establishes a dependency or integration pattern;
- creates a constraint that future work must understand;
- has meaningful alternatives or consequences worth preserving.

Use [`../arch/`](../arch/) for descriptions of the system as it is, and
[`../spec/`](../spec/) for what the product must do.

## Naming

Sequential identifiers and a concise kebab-case title that states the decision:

```text
ADR-0NN-short-decision-title.md
```

Copy [`ADR-000-template.md`](ADR-000-template.md) to start one. `ADR-000` is
reserved for the template, and a number is never reused.

## Structure

Each record contains, in order: title and identifier; a header with `Status`,
`Date` and `Related`; **Context**; **Decision**; **Rationale**; **Alternatives
considered** (each one a heading ending "— rejected", with the reason); and
**Consequences**, split into **Positive** and **Negative**.

## Status

| Status | Meaning |
| --- | --- |
| `Proposed` | Written, not yet agreed. Nothing may be built against it |
| `Accepted` | Agreed and in force |
| `Deprecated` | No longer applies, with nothing replacing it |
| `Superseded` | Replaced; the header names the successor, which names it back |

**Each record reads as one coherent, current decision.** A correction or
clarification that leaves the decision intact is written into the Context,
Decision and Consequences where it belongs — not appended as an amendment
section — and git history is the trail of how the text changed. When a decision
changes materially, write a new ADR and mark the old one `Superseded`, naming its
successor; that is the only kind of history a record carries.

The existing records carry `Date: Template baseline`: they were written as the
starting set of the template, not at a point in a project's life. A record added
by a project carries its real date.

## Keeping the rules and the records together

The root `CLAUDE.md` summarizes the rules these records establish, each linked to
its ADR. When a decision changes, update the ADR and that summary in the same
change.

## Records

| ID | Decision | Status |
| --- | --- | --- |
| [ADR-000](ADR-000-template.md) | Template — copy it to start a record | — |
| [ADR-001](ADR-001-java-25-maven-multi-module.md) | Java 25 and a Maven multi-module build | Accepted |
| [ADR-002](ADR-002-layered-core-and-apps-boundary.md) | A layered core and an apps/ boundary | Accepted |
| [ADR-003](ADR-003-core-dependency-exclusions.md) | Core dependency exclusions | Accepted |
| [ADR-004](ADR-004-core-touches-no-io.md) | Core touches no I/O; every I/O crossing is a port | Accepted |
| [ADR-005](ADR-005-abstractions-for-a-current-use-case.md) | Add abstractions only for a current use case | Accepted |
| [ADR-006](ADR-006-testcontainers-for-integration-tests.md) | Testcontainers for integration tests, and no skipped suites | Accepted |
| [ADR-007](ADR-007-spring-boot-http-api-composition-root.md) | Spring Boot HTTP API as the composition root | Accepted |
| [ADR-008](ADR-008-postgresql-spring-jdbc-flyway.md) | PostgreSQL persistence with Spring JDBC and Flyway, no JPA | Accepted |
| [ADR-009](ADR-009-react-typescript-and-spring-bff.md) | React, TypeScript, and a Spring Boot backend-for-frontend | Accepted |
| [ADR-010](ADR-010-oidc-server-side-session-and-browser-security.md) | OIDC server-side sessions and browser security | Accepted |
| [ADR-011](ADR-011-jwt-resource-server-and-roles.md) | JWT resource server with role-based access, plus a dev-token mode | Accepted |
| [ADR-012](ADR-012-generated-contracts-and-remote-frontend-state.md) | Generated contracts and remote frontend state | Accepted |
| [ADR-013](ADR-013-mui-wcag-22-aa-design-system.md) | Material UI with a WCAG 2.2 AA design-system target | Accepted |
| [ADR-014](ADR-014-real-service-browser-acceptance.md) | Real-service browser acceptance | Accepted |
| [ADR-015](ADR-015-archunit-nightly-ring-report.md) | ArchUnit reports on the rings nightly, and does not gate the build | Accepted |
| [ADR-016](ADR-016-one-logging-story-and-a-silent-core.md) | One logging story, and a silent core | Accepted |
| [ADR-017](ADR-017-static-spa-without-a-reverse-proxy.md) | The SPA is static assets, with no reverse proxy of its own | Accepted |
| [ADR-018](ADR-018-merge-commits-not-squash.md) | Merge commits, not squash, because branches stack | Accepted |
| [ADR-019](ADR-019-coverage-ratchet-not-a-target.md) | Coverage is a per-module ratchet, not a target | Accepted |
| [ADR-020](ADR-020-resource-shape-and-url-nesting.md) | Resource shape decides URL nesting | Accepted |
| [ADR-021](ADR-021-one-migration-stream-and-one-baseline.md) | One migration stream and one baseline per database | Accepted |
| [ADR-022](ADR-022-contract-versions-allocated-at-delivery.md) | A contract version is allocated at delivery, not reserved by a specification | Accepted |
| [ADR-023](ADR-023-identifiers-are-uuids.md) | Identifiers are UUIDs | Accepted |
| [ADR-024](ADR-024-sorting-follows-the-collection.md) | Sorting follows the collection, not the row count | Accepted |
| [ADR-025](ADR-025-aws-deployment-topology.md) | AWS deployment topology — EKS, one RDS server, and CloudFront for the SPA | Accepted |
| [ADR-026](ADR-026-cli-is-a-client-of-the-api.md) | The CLI is a client of the API, not a second composition root | Accepted |
| [ADR-027](ADR-027-feature-sliced-design-for-the-spa.md) | The SPA is organized by Feature-Sliced Design, and its layering is linted | Accepted |
