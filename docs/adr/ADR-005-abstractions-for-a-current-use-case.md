# ADR-005: Add abstractions only for a current use case

- Status: Accepted
- Date: Template baseline
- Related: [ADR-002](ADR-002-layered-core-and-apps-boundary.md), [ADR-003](ADR-003-core-dependency-exclusions.md), [ADR-004](ADR-004-core-touches-no-io.md), [ADR-007](ADR-007-spring-boot-http-api-composition-root.md)

## Context

A layered style ([ADR-002](ADR-002-layered-core-and-apps-boundary.md)) makes
abstraction cheap to add and easy to justify. There is always a plausible
future caller for another interface, another module, another framework: a second
database, a message queue, a batch runner, a new protocol. Each addition is small
on the day it lands, and each one constrains decisions that have not been made
yet.

The question this record answers is where the bar sits.

## Decision

**Add an abstraction — an interface, a module, a framework, a protocol — only for
a use case that exists now, or for an extension point the plan names as
immediate.** A second vendor adapter that the current plan schedules clears the
bar; one that someone imagines does not.

**An input port per endpoint does not clear it.** Controllers in `apps/api` call
flows directly (`CreateItemFlow`, not a `CreateItemUseCase` interface with
request and response models in front of it). A flow is a plain class; it is its
own seam.

**A framework is adopted when there is a caller for it.** The same rule that
defers an interface defers a dependency tree: Spring Boot sits in `apps/api`
because an HTTP caller exists ([ADR-007](ADR-007-spring-boot-http-api-composition-root.md)),
not because a server might one day be wanted.

**Outbound ports are not speculative.** A port required by
[ADR-004](ADR-004-core-touches-no-io.md) exists because `core` may not touch the
crossing itself, not because a second adapter is expected. One adapter per port
is the normal case, and is not a reason to inline it.

The template's own `item` subdomain is the current use case for everything it
ships: each port, flow and module is there because the example exercises it. A
project built on the template adds abstractions as its own use cases arrive.

## Rationale

An abstraction adopted before it is needed imposes constraints on decisions that
have not been made. It fixes a shape before the second caller has said what it
needs, and the shape it fixes is usually the first caller's, generalised by
guesswork. Waiting costs a refactor when the second caller arrives — and that
refactor is cheaper than it looks, because by then the requirement is known.

A framework is the most expensive abstraction to adopt early. Its dependency tree
and configuration surface are effectively permanent, and it puts standing
pressure on [ADR-003](ADR-003-core-dependency-exclusions.md), because the easiest
way to wire a framework application is to annotate the things it wires.

The cheapest moment to choose an inbound protocol, a storage technology or an
integration style is when there is something to expose and a real caller to
satisfy.

## Alternatives considered

### Full Clean Architecture — an input port per use case — rejected

An interactor interface plus request and response models for every endpoint.
Its usual justification is that it lets the use case be tested without the
framework. That justification does not apply here: flows already have no
framework in them ([ADR-003](ADR-003-core-dependency-exclusions.md)), and a test
constructs one directly with fake ports. The interface would buy indirection, not
isolation, and double the number of types a reader must follow from controller to
behaviour.

### Adopt a framework early to prove the deployment path — rejected

A server with only a health endpoint gives CI something to smoke-test and
validates packaging early. Rejected because a health endpoint over an empty
domain validates nothing about the architecture, while the framework's cost is
paid in full from the first day.

### Anticipatory extension points — rejected

Interfaces, plugin registries or generic base classes (`CrudRepository<T>`,
`AbstractFlow`) added so that future subdomains can be added "without touching
existing code". Rejected because the extension point's shape is guessed from one
example, and the second subdomain rarely fits the guess; the result is an
abstraction that every later caller works around.

## Consequences

### Positive

- No framework or indirection cost is paid before there is a use for it.
- A reader follows a request from controller to flow to port with no interface
  layer in between.
- Decisions about protocols, storage and integration are made when there is
  information to make them with, rather than by accident.

### Negative

- "Current use case" and "immediate extension point" are judgements, and
  reviewers will draw the line in different places.
- Adding an abstraction later costs a refactor across its callers. That cost is
  real, and it is accepted as the price of not guessing.
- Controllers are coupled to flow signatures directly, so a change to a flow's
  parameters ripples to its controller. With one inbound adapter calling each
  flow, that is one edit.
- Deferring a decision leaves its constraints undiscovered. If a target
  environment imposes requirements on packaging or protocol, they surface when
  the decision is finally made, not before.
