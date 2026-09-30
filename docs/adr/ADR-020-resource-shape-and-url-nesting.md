# ADR-020: Resource shape decides URL nesting

- Status: Accepted
- Date: Template baseline
- Related: [ADR-007](ADR-007-spring-boot-http-api-composition-root.md),
  [ADR-008](ADR-008-postgresql-spring-jdbc-flyway.md),
  [ADR-012](ADR-012-generated-contracts-and-remote-frontend-state.md),
  [ADR-023](ADR-023-identifiers-are-uuids.md),
  [ADR-024](ADR-024-sorting-follows-the-collection.md)

## Context

Every resource added to `openapi-v1.yaml` raises the same question: is it a
top-level collection, or does it nest under the entity it relates to? A record
that names another record looks as if it "belongs" to it, and the tempting
answer is to nest it — `/items/{itemId}/orders/{orderId}` rather than
`/orders/{orderId}`. Left unwritten, the answer is decided per endpoint at
review time, and a contract ends up carrying both shapes with nothing to say
why. The asymmetry then reads as inconsistency even where it is a rule applied
twice.

The schema is where the difference is least deniable. A resource that is the
root of its own aggregate has a `uuid` primary key of its own, other tables hold
foreign keys *to* it, and its relation to a neighbouring entity is a column that
may outlive that neighbour. A resource that is a dependent part of its parent
has no identifier of its own: it is read as "the one belonging to this parent",
and it disappears with the parent.

Industry guidance draws the same line. Zalando's RESTful API Guidelines, rule
**145** (*"MAY consider using (non-) nested URLs"*): nest when the sub-resource
is only reachable through its parent and cannot exist without it; when it has a
unique id and can be addressed directly, expose it at the top level. Rule
**147** (*"SHOULD limit number of sub-resource levels"*) caps nesting at three,
because depth costs both comprehension and path length. Google's AIP-156
describes the nested case precisely — a singleton "must always exist by virtue
of the existence of its parent", "must not have a user-provided or
system-generated ID", and is named as its parent plus one static segment.
AIP-159 describes the smell on the other side: listing across a nested parent
needs a `-` wildcard in the parent position. The Azure REST API Guidelines close
the loop by requiring URLs "in a consistent form regardless of the URL used to
reach the resource", which is a prohibition on a second canonical URL.

## Decision

**The path mirrors the aggregate root.**

1. A resource with **its own identity and an independent lifecycle** is a
   top-level collection. Its relationship to other entities is a field in the
   body, and filtering by that field is a query parameter. `/items/{itemId}` is
   the template's example.
2. A resource that **cannot exist without its parent and has no identifier of
   its own** is a nested singleton: the parent's path plus one static segment,
   for instance a hypothetical `/items/{itemId}/settings`.
3. A resource that has its own identifier **but is owned by a parent and is
   never listed across parents** is a nested collection under that parent.
4. **At most three sub-resource levels**, counting static segments below the
   root collection. A namespace segment such as `/admin` groups collections; it
   is not a collection and does not count.
5. **No resource gets a second canonical URL for convenience.** Convenience is
   a query filter on the canonical collection.

## Rationale

Clause 1 is what keeps a top-level resource top-level even though it names a
parent. Were a hypothetical `order` nested under `item`, the natural "all
orders" list would have to be spelled `/items/-/orders`, which is AIP-159's
wildcard admitting that the nesting was wrong. Operations that span parents —
comparing two orders that need not share an item, deleting one order without
reference to its item — would have no honest home either.

Clause 2 is what makes a dependent part correct as a static segment: there is no
id to address, and the `GET` answers "the one belonging to this parent", which
is the singleton read AIP-156 describes.

Clause 3 covers the case between them. A resource with an id that only ever
makes sense inside one parent — and is never queried across parents — gains
nothing from being top-level, and nesting it tells the reader that it dies with
its parent.

Clause 5 is the one that costs something, and it is deliberate. The obvious
request — "also expose this parent's children at a nested path" — is refused.
A screen that shows one item's orders issues `GET /orders?itemId=…` against the
canonical collection rather than calling a parent-scoped route. One URL per
resource means one set of links, one cache key and one authorization check to
get right.

## Alternatives considered

### Consistency by uniformity — rejected

Nesting everything that has an owner, or flattening everything, would produce
one shape and would be easy to remember. Both lose information the rule
carries: the path stops telling a reader whether the resource survives its
parent.

### Deciding per endpoint at review time — rejected

That is how the question arises in the first place. A reviewer with no written
criterion argues from taste, and taste does not converge across several
subdomains and many pull requests.

## Consequences

### Positive

- **Clause 4 is mechanical.** Nesting depth is counted by a test beside
  `ContractPathsAreServedTest`, which already parses `openapi-v1.yaml`; a path
  deeper than three sub-resource levels fails the build.
- **The path tells a reader the lifecycle.** A top-level collection survives
  its neighbours; a nested segment does not.
- **A change of shape is a reviewable contract change.** A resource that later
  gains an identifier moves from clause 2 to clause 3 or clause 1, and its path
  changes. `ContractPathsAreServedTest` fails if a declared path stops being
  served, and `BffContractParityTest` fails if the portal contract proxies a
  path the application contract no longer declares.

### Negative

- **Clauses 1 to 3 and 5 are judgement, not a test.** They belong to review,
  and this record is what a reviewer cites.
- **Clause 5 refuses a convenience some clients will ask for.** A
  parent-scoped list costs a query parameter instead of a path segment.
- **No grandfathering.** Where an existing path breaks a clause, the finding is
  a defect to record and fix, not a precedent.
