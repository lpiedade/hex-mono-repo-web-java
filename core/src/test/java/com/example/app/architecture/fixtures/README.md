# Planted architecture violations

A mirror of `core`'s three rings, deliberately broken, so
`ArchitectureTest.everyRuleCanFail()` can prove each rule is falsifiable.

**Do not fix anything in here.** A green fixture is a failing self-test: it means the
rule it was planted for can no longer be shown to fire, which is how a rule quietly
becomes decoration. ADR-015 rejected several proposed rules precisely because they could
never fail; this directory applies that standard to the instrument itself.

These classes never reach the real report. `ArchitectureTest.theRingsHold()` imports with
`DoNotIncludeTests`, which filters `target/test-classes` by path — and that is where these
compile to.

| Fixture | Plants |
| --- | --- |
| `domain/RootDweller` | rule 6 — a class in a ring root rather than a subdomain |
| `domain/one/DomainOne` | rule 1 — `domain` implementing a `ports` interface; rule 4 — half of a `domain` cycle |
| `domain/two/DomainTwo` | rule 4 — the other half |
| `flows/one/FlowsOne` | rule 4 — half of a `flows` cycle |
| `flows/two/FlowsTwo` | rule 4 — the other half |
| `flows/host/OpensEveryResource` | rule 3 — one parameter per alternative of its pattern |
| `flows/host/ReadsTheHost` | rule 8 — every clock and generator in its set, both randomness types, and `Instant::now` as a method reference |
| `ports/one/APort` | nothing — a legitimate Port, the target `DomainOne` reaches for |
| `ports/one/PortsOne` | rule 5 — a `ports` class that is neither Port, Port DTO nor Port failure; rule 4 — half of a `ports` cycle |
| `ports/two/PortsTwo` | rule 2 — `ports` depending on `flows`; rule 4 — the other half |

## Cover clauses, not just rules

Each fixture reaches **every alternative** of the rule it plants, not one of them. A
pattern with seven branches exercised by one fixture leaves six branches unproven, and an
unproven branch is where a rule quietly stops working while still reporting zero.

`ReadsTheHost` carries the sharpest case: `Instant::now` is a method *reference*, which is
different bytecode from a call. It is exactly how `adapters/jvm` supplies the value — so it
is precisely the shape in which the crossing could return to `core` unseen. A rule that only
looks at calls misses it.
