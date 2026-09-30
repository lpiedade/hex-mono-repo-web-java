# ADR-018: Merge commits, not squash, because branches stack

- Status: Accepted
- Date: Template baseline
- Related: none — this record covers development process rather than system
  structure.

## Context

Work on this repository is done in several git worktrees at the same time,
under `.claude/worktrees/`. Several are live at any moment alongside the main
checkout, each on its own branch, and more than one session may be editing the
tree concurrently. Branches are cut from `main` and also from each other, and a
long-lived branch merges `main` back in mid-flight to re-verify against a base
that keeps moving.

That working style makes commit identity load-bearing. Git decides what a
branch still owes the base by ancestry, not by content: two commits with the
same diff and different SHAs are two separate pieces of work as far as
`git merge`, `git log base..HEAD` and conflict resolution are concerned.

A squash merge gives the branch's content a new SHA with no ancestry to the
commits it came from. The branch it was merged from, and every branch cut from
that one, keeps reporting those commits as unmerged. A pull request raised from
such a branch re-proposes files `main` already has — and, if the branch has
since fallen behind, proposes deleting whatever `main` gained after the merge
base. The usual remedy is to abandon the branch and re-cut the change from
`origin/main`.

Two further properties of this repository are per-commit, and a squash
collapses them:

- **The commit conventions** in `CLAUDE.md` — Conventional Commits, a subject
  of at most 72 characters, and body bullets that explain *why*. A squash takes
  its message from the pull-request title and description instead, so the
  messages that were actually reviewed are discarded.
- **Traceability.** Every acceptance criterion in an implementation issue cites
  the requirement it satisfies. Keeping a commit per criterion is what lets
  `git blame` and `git log -S` land on the commit whose body carries the
  reasoning, rather than on one blob spanning a whole issue.

## Decision

**A pull request is merged with a merge commit — `gh pr merge --merge`, or
*Create a merge commit* in the GitHub UI. Squash and rebase merges are not
used.**

The branch's commits enter `main` with their own identity and their own
messages. The merge commit is the unit of "one pull request", and
`git log --first-parent main` is the way to read history at that granularity.

This applies to every pull request, including a single-commit one: squashing a
branch that holds one commit still mints a new SHA and still replaces the
reviewed message with the pull-request description.

## Alternatives considered

### Squash and merge — rejected

Its benefits are real but already available: "one commit to revert" is
delivered by `git revert -m 1 <merge-sha>`, and "one line per pull request" is
delivered by `git log --first-parent`. Neither requires discarding the branch's
commits, and discarding them is what breaks stacked and long-lived branches.

Squash is a good default for a repository where branches are short-lived,
independent and never merged into one another, and where commit hygiene on the
branch is not enforced. None of those conditions hold here.

### Rebase and merge — rejected

Rebase preserves the individual commits and their messages, so it avoids the
message-loss objection. It still rewrites every SHA, which is the objection
that breaks stacked branches, and it produces no merge commit — so there is no
single object to revert and no first-parent line to read history by. It is
strictly worse than a merge commit for this repository.

### Squash only for pull requests marked as trivial — rejected

A per-pull-request exception requires the person merging to know whether any
other branch was cut from the one being merged. That is not knowable from the
GitHub UI, and in a tree with several concurrent worktrees it is exactly the
fact most likely to be wrong. A rule that holds only when someone checks
something unverifiable is not a rule.

## Consequences

### Positive

- A branch cut from another branch keeps working after its base is merged, and
  re-merging `main` into a long-lived branch is a no-op for commits already
  shared, instead of replaying conflicts.
- `git log base..HEAD` answers "what does this branch still owe `main`"
  truthfully, which is what makes a pre-merge check meaningful.
- Commit messages written to the conventions survive into `main`, and
  requirement traceability stays at commit granularity.
- Reverting a whole pull request remains one command:
  `git revert -m 1 <merge-sha>`.

### Negative

- **Commit hygiene on the branch matters.** Squash is an eraser for `wip` and
  `fix typo` commits; without it, whatever is on the branch lands on `main`.
  Authors tidy their branch before requesting a merge — with an interactive
  rebase on their own unpushed work, which this record does not forbid because
  it happens before anyone depends on those commits.
- `git log main` without `--first-parent` is more verbose than a squashed
  history, and it interleaves commits from branches merged around the same
  time. Reading it at pull-request granularity requires the flag.
- The rule is enforced by memory until the repository settings disable *Squash
  and merge* and *Rebase and merge*. That is an admin action on the GitHub
  repository and is not done by this record.
