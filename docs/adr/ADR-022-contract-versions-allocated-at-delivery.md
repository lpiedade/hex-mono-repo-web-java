# ADR-022: A contract version is allocated at delivery, not reserved by a specification

- Status: Accepted
- Date: Template baseline
- Related: [ADR-009](ADR-009-react-typescript-and-spring-bff.md),
  [ADR-012](ADR-012-generated-contracts-and-remote-frontend-state.md),
  [ADR-026](ADR-026-cli-is-a-client-of-the-api.md)

## Context

The template carries independently versioned contracts. The application API's
response bodies start with `schemaVersion`, declared in `openapi-v1.yaml`; the
browser-to-BFF contract carries `portalApiVersion`, declared in
`portal-api-v1.yaml` and sent as the `X-Portal-Api-Version` header. A project
built on the template will add more — an export format, a persisted document, a
configuration file with a root `version` key. Each needs a rule for *how* it
evolves (an explicit version, no silent migration, older versions keep their
meaning), and each also needs a rule for *who picks the number*.

Left unstated, the natural habit is for each specification under `docs/spec/`
to pick its own: one higher than the specification before it, written as a
requirement — "raises `schemaVersion` from `2` to `3`".

**A reserved number is correct only if delivery follows the numbering.** It does
not, and the planning conventions never promise that it will: priority is
product-absolute and lives in the feature register, ordering lives in the
implementation plan, and a `Could`-tier specification can sit unbuilt while a
later one ships. When that happens the failures are predictable:

- **Double allocation.** A change that ships first takes the next number for
  itself, without noticing that an unbuilt specification had already written
  that number down for something else. Every later reservation is now displaced
  by one.
- **Unperformable requirements.** A contract jumps several numbers in one
  delivery, and the specifications that each mandated one rung — "from `2` to
  `3`" — describe an increment that did not happen and now cannot.
- **Contradictory restatements.** The current number is repeated in several
  specifications and in a contract's prose description, none of which owns it,
  and they drift apart. A reader cannot tell a superseded number from a live
  obligation.

The numbers are cheap to fix. The defect is the mechanism that keeps producing
them.

## Decision

1. **A version number is allocated when the change that introduces it is
   delivered.** Until then the number does not exist, and a specification that
   has not shipped does not name one.
2. **An allocated number is a fact and does not move.** Once a number is in a
   released contract, in a client, or in a file someone wrote, it keeps its
   meaning.
3. **This table is the allocation record.** It is the one place that holds the
   fact; a delivery that raises a contract amends this table in the same pull
   request.

   | Contract | Allocated | Authority |
   | --- | ---: | --- |
   | Application API representation (`schemaVersion`) | `1` | `openapi-v1.yaml`, `SchemaVersion` |
   | Browser-to-BFF contract (`portalApiVersion`, `X-Portal-Api-Version`) | `1` | `portal-api-v1.yaml` |

4. **An unshipped specification states its version requirement relationally.**
   "The representation version that introduces orders", not "`schemaVersion:
   2`"; "every previously allocated version", not "versions `1` through `3`".
   The compatibility guarantee — older versions keep their meaning — holds
   whatever the new number turns out to be.
5. **The rule is not retroactive.** An allocated number stays written as a
   literal wherever it appears: a statement about shipped behaviour is not a
   reservation.

## Rationale

**A reservation buys nothing and risks a collision.** A number written into an
unbuilt specification is read by no parser, generates no code and gates no
test. Its only reader is a human deciding what to write next, who is better
served by "the next free number" than by one chosen in a plan that has since
changed.

**Relational wording is how the rest of a specification already works.** A
requirement says "as long as the record exists" rather than naming a duration;
naming a successor number is the outlier, and the outlier is what breaks.

**One table beats many prose restatements.** A document that restates a fact it
does not own cannot stay true. Contract versions are such a fact, and the only
moment anyone knows the next number is the pull request that raises it.

## Alternatives considered

### Renumber the reservations whenever delivery gets out of order — rejected

Cheapest, and it restores the invariant for exactly as long as the next
out-of-order delivery takes. Delivery order has no reason to converge on
specification order: the implementation plan batches work by the surface it
touches, not by specification number. Renumbering treats the symptom and
re-arms the mechanism.

### Move a shipped number to resolve a collision — rejected

A shipped number is in clients, generated code and files people already hold.
Moving it breaks things that work today to protect a number reserved by
something that may never be built.

### Keep the reservations and add a cross-reference index — rejected

The same restatement problem one level up: an index of who reserved what is one
more document that must be kept true against every document that believes it
owns the number.

## Consequences

### Positive

- **No double allocation.** Only a delivered change can take a number, and it
  takes the next free one.
- **One place to look.** The table above is the answer to "what version is this
  contract at".
- **Contracts stay independently versioned.** Raising one does not imply
  raising another; nothing here unifies them, and a sentence that tries to fix
  every contract's number at once is the kind of restatement this rule exists
  to prevent.

### Negative

- **The table must be amended on delivery.** A real, one-line obligation,
  discharged by the pull request that raises the version — the only moment at
  which anyone knows the number.
- **An unbuilt specification no longer says what its version will be.**
  Someone sizing that work gets "the next free number" instead of a literal.
  The literal would have been a guess, so the loss is nominal.
