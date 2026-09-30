# ADR-024: Sorting follows the collection, not the row count

- Status: Accepted
- Date: Template baseline
- Related: [ADR-012](ADR-012-generated-contracts-and-remote-frontend-state.md),
  [ADR-005](ADR-005-abstractions-for-a-current-use-case.md),
  [ADR-002](ADR-002-layered-core-and-apps-boundary.md)

## Context

Two requirements are commonly written for a portal's lists: that lists are
"filtered, sorted and paginated on the backend", and that no page loads a whole
dataset to filter it in memory. Read together they are easily taken to mean the
portal never sorts anything itself, and a shared table primitive documented as
*"sort and pagination are controlled: the backend owns them"* repeats that
reading.

A real portal does not match it. Its lists fall into two populations:

- collections that are **bounded by the model** — a list of configured items,
  the members of one parent — which a screen fetches whole, with no `limit` and
  no cursor, and holds;
- collections that are **open-ended** — history, events, anything that grows
  with use — which a screen pages through the backend.

A rule that names only the second population has a predictable consequence. It
is not that the portal over-fetches; it is that **no list offers sorting at
all**. Sorting a bounded list looks as if it requires an API change — a sort
parameter, a repository change — that the bounded list neither needs nor
benefits from, so nobody wires it, and the table's sort capability sits built,
accessible and unreachable from every screen.

The obvious relaxation — "sort in memory when there are few rows" — is the
wrong rule, and the reason is the trap this decision exists to close. "Few
rows" describes what is *on screen*. A keyset-paginated list showing twelve
rows of three hundred is also few rows, and sorting those twelve reorders a
window while looking exactly as if it reordered the list. The defect is
invisible in review, invisible in a screenshot, and invisible to the user, who
has no way to know the ordering excluded rows two pages away.

## Decision

**Who sorts a list is decided by who holds it, not by how large it is.**

1. A screen that fetched its collection **whole** — no `limit`, no cursor, no
   pagination props on `DataTable` — sorts it **in memory**, through the
   `useClientSort` hook beside `DataTable`. It issues no request to reorder.
2. A screen that **pages through the backend** sends the sort with its next
   request. It must never sort the rows it currently holds.
3. The two are never mixed on one table, and the test that distinguishes them
   is mechanical rather than a judgement: a `DataTable` that receives
   `page`/`rowCount`/`onPageChange`, or a screen holding a cursor, is in case 2.
4. `DataTable` itself remains a pure renderer. It reorders nothing and fetches
   nothing; it displays the order it is handed and reports the clicked column.
   This is what lets one primitive serve both cases without a mode flag.

`useClientSort` owns the comparison rules each call site would otherwise get
wrong on its own: `Intl.Collator` under the active locale with
`numeric: true`, absent values last in **both** directions, a copied array so
the React Query cache ([ADR-012](ADR-012-generated-contracts-and-remote-frontend-state.md))
is not mutated, and a stable sort so ties keep the backend's order.

A bounded collection loaded whole does **not** violate "no page loads a whole
dataset". That rule forbids loading an open-ended dataset to filter it on the
client. It does not forbid holding a list whose size is bounded by the model,
and a specification that states both rules must say which collection falls
under which.

## Rationale

The distinction that decides correctness is whether the client holds the whole
collection. Fetching strategy answers that question exactly; row count does
not answer it at all. Tying the sort strategy to the fetch strategy makes the
correct choice fall out of a fact already visible at the call site — the
presence of pagination props or a cursor — instead of a threshold someone has
to pick.

Keeping the logic in a hook rather than the table keeps the table's contract
simple: it never reorders its input, so reading a screen tells you who ordered
its rows.

## Alternatives considered

### A `clientSort` boolean on `DataTable`, sorting internally — rejected

Fewer moving parts at the call site, and it could refuse the combination with
the pagination props outright, turning rule 3 into a runtime invariant instead
of a convention. Rejected because it puts ordering logic — locale collation,
absent-value placement, accessor dispatch — inside the presentational primitive
every list screen shares, and because a `DataTable` that sometimes reorders its
input and sometimes does not is harder to reason about than one that never
does. The guard is worth revisiting on its own if the convention is ever broken
in practice; it is a smaller change than this one.

### Sort everything on the backend, and add the parameters — rejected

Consistent, and it keeps the "backend sorts" requirement as written. Rejected
as disproportionate: it requires a contract change, a repository change and a
cursor change per endpoint, to reorder lists the browser already holds in full
and can sort in under a millisecond.
[ADR-005](ADR-005-abstractions-for-a-current-use-case.md)'s bar — abstractions
only for a current use case — cuts against paying that for a bounded list.

### Sort in memory below a row-count threshold — rejected

It is the trap described in the Context. A threshold measured on the rendered
page cannot distinguish a complete short list from a short page of a long one,
which is precisely the distinction that decides correctness.

## Consequences

### Positive

- Sorting is reachable. Every bounded list gains it with no API work.
- A paginated list gains sorting only when its endpoint accepts a sort
  parameter, which for a keyset list additionally means the cursor must encode
  the sort key — a real API change, correctly priced rather than accidentally
  skipped.
- The rule is stated so that the wrong version of it is visibly wrong. "Few
  rows" appears nowhere as a criterion.

### Negative

- A screen's sorting strategy is a consequence of its fetching strategy, so the
  two must change together. If a bounded collection's endpoint ever grows a
  cursor, removing `useClientSort` from that screen is part of the same change,
  not a follow-up. The hook's documentation and the call site's comment should
  both say so.
- Nothing here is enforced mechanically. A paginated screen calling
  `useClientSort` compiles. The hook's documentation and this record are the
  whole defence, and a review that only checks "does it sort correctly on
  screen" will not catch the mistake — the broken case looks correct.
