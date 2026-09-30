# System Design Records

This directory holds **design records**: documents written before or while a
subsystem is built, to reason about how it should work. It starts empty.

## What belongs here

A design record is worth writing when a capability spans several modules and the
arrangement is not obvious from the specification alone — for example:

- the components involved, their responsibilities, and the ports between them;
- data and execution flows, including failure and retry paths;
- transaction boundaries and concurrency (what one `UnitOfWork` covers, what
  races are possible, which constraint prevents them);
- lifecycle and state machines of an aggregate;
- capacity, bounds and backpressure;
- the operational view: what is logged, what an operator sees when it fails.

Name it after the capability: `<capability>.md`, and link the functional
specification (`docs/spec/FS-0XX-*.md`) it serves.

## What does not belong here

| Content | Home |
| --- | --- |
| What the product must do, and how it is accepted | [`docs/spec/`](../../spec/) |
| A decision with alternatives and trade-offs | [`docs/adr/`](../../adr/) |
| The system as it is — contracts, schema, modules | [`api-layer/`](../api-layer/), [`data-layer/`](../data-layer/), [`module-dependency-map.md`](../module-dependency-map.md) |

## How a design record stays honest

A design record is **not rewritten afterwards to match whatever was built**: a
design edited to agree with its implementation stops being either. Instead, each
record opens with a currency block:

```markdown
- Status: Design record — written YYYY-MM-DD, before implementation
- Currency: <what has changed since, and where the current truth lives>
```

Extend the currency block when something diverges, rather than the prose. When a
decision in the record turns out to matter on its own, lift it into an ADR and
link it.
