# Plans

Non-normative delivery planning for App. Nothing here defines behaviour; that is
what the [functional specifications](../spec/) are for. Nothing here records a
design decision; that is [`docs/adr/`](../adr/).

## The two documents

| Document | Owns | Read it when |
| --- | --- | --- |
| [Feature register](feature-register.md) | **Priority and result.** One row per feature: its MoSCoW tier, the obligations it covers, whether it is delivered, and the evidence | You want to know how important something is, or whether it is done |
| [Implementation plan](implementation-plan.md) | **Ordering.** Execution waves, batched by the surface they touch | You want to know what to work on next |

## The rule that keeps them true

Each kind of fact has one home, and no document restates a fact it does not own:

| Fact | Home |
| --- | --- |
| Obligation — `FR` / `SEC` / `AC` | [`docs/spec/`](../spec/) |
| Priority — Must / Should / Could / Won't | [Feature register](feature-register.md) |
| Result — delivered, with evidence | [Feature register](feature-register.md) |
| Ordering — what to do next | [Implementation plan](implementation-plan.md) |
| State — open, closed, blocked, pickable | GitHub issues |
| Ideas that are not yet specified | A GitHub issue without `ready-for-agent` |

A document that restates a fact it does not own cannot stay true: it ends up
describing merged work as pending, which a reader takes as guidance, and every
other row loses its credibility with it. The separation above is worth more than
any individual row in these files.

**State is the fact most often restated and most expensive to get wrong.**
Neither document records whether an issue is open. Ask GitHub.

## How maintenance works

**The reader is the maintainer.** Whoever is about to start work — a person or an
agent — checks that the issues involved are still open and unblocked, because
that cost is unavoidable anyway. If a plan is wrong, they fix it in the first
commit of the work. That is not scope creep; it is the only maintenance these
files get, and it corrects the most-read parts most often.

No convention that asks the *author* of every change to also update a plan
survives a busy repository.

## Priority is not scheduling, and neither is pickability

- **Priority** is product-absolute and lives on the feature: *Must* means the
  product is not deliverable without it, not that it ships first. It is mirrored
  onto issues as the `must` / `should` / `could` labels.
- **Pickability** (`label:ready-for-agent -label:blocked`) answers *what may be
  worked*, never *what should be*.
- **Ordering** is the implementation plan's, and only its.

A Must-tier feature can sit in a late wave, which is why tier and order are
separate axes and must not be collapsed.
