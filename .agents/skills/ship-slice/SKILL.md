---
name: ship-slice
description: Ship one vertical slice — a GitHub child issue — from ticket to merge-ready PR. Use when the user asks to implement or ship a slice, mentions /ship-slice, or a worker is prompted with `/ship-slice <issue> orchestrated` by /orchestrate-slices.
argument-hint: "<issue> [orchestrated]"
---

# Ship Slice

Implement exactly one vertical slice from its GitHub ticket to a production-ready PR.

One slice = one child issue = one worktree = one branch = one PR.

Run each step in order; do not proceed until the current step's `Done when` holds.

## Execution modes

### Orchestrated mode

```text
/ship-slice <issue> orchestrated
```

The orchestrator already selected this slice, created and bootstrapped its Herdr worktree and dedicated branch, and launched this worker inside it.

This worker owns only this slice: no new worktree, no new branch, no sibling slices, no `/slice-relay`, no launching agents, no touching the parent tracker, no merging the PR.

The orchestrator owns scheduling, parallelism, worktree lifecycle, parent state, merge serialization and authorization, and cleanup.

### Standalone mode

```text
/ship-slice <issue>
```

May create its own branch and merge its own PR. Still owns only one slice and must not orchestrate siblings.

## Synchronization recipe

Use whenever this branch must absorb an advanced `origin/$BASE`: before the first push, before declaring readiness, or when the orchestrator revokes readiness.

```bash
git fetch origin "$BASE"
```

Staleness check before first push — count commits missing from this branch:

```bash
git rev-list --count HEAD.."origin/$BASE"
```

Readiness check — require the current base to be contained in this branch:

```bash
git merge-base --is-ancestor "origin/$BASE" HEAD
```

If stale:

```bash
git rebase "origin/$BASE"
```

Resolve conflicts by, in order: current OpenSpec artifacts, current integration-branch behavior, this slice's acceptance criteria, repository domain and architecture conventions. Never blindly take `ours` or `theirs`.

After any meaningful rebase or conflict resolution, rerun `pnpm test`, `pnpm lint`, `pnpm build`, and rerun `/code-review` when implementation materially changed.

Push rewritten history with `git push --force-with-lease`; never bare `--force`. Then wait for fresh CI and required reviews, and re-run the readiness check.

## 1. Orient the slice

```bash
gh issue view <N>
```

Resolve the parent tracker, acceptance criteria, declared blockers, referenced OpenSpec change, required skills, and any deliberately deferred behavior.

If this issue itself has implementation sub-issues, it is a tracker, not a slice — stop and direct the caller to `/orchestrate-slices`.

Confirm every declared blocker is completed (GitHub-native blocking relationships when available). If a blocker remains open:

```text
BLOCKED: issue #<N> depends on open issue #<blocker>
```

Stop; do not bypass the dependency graph.

Read the OpenSpec change:

```text
openspec/changes/<change>/
├── proposal.md
├── design.md
├── specs/
└── tasks.md
```

`specs/` is the behavioral contract, `design.md` the intended technical direction, `tasks.md` implementation guidance, and the ticket's acceptance criteria this slice's exact delivery boundary.

Map every acceptance criterion to an implementation surface and a verification method. Name anything deliberately deferred and the ticket that owns it; do not absorb another slice merely because touching it would be convenient.

Done when: scope, blockers, and OpenSpec artifacts are understood; every acceptance criterion has an implementation and verification path; deferred work is owned elsewhere.

## 2. Verify the worktree and branch

```bash
BASE="$(gh repo view --json defaultBranchRef -q '.defaultBranchRef.name')"
git fetch origin "$BASE"
BASE_SHA="$(git rev-parse "origin/$BASE")"
```

Record `$BASE_SHA`; step 5's Fallow audit uses it. Branch from and compare against the fetched `origin/$BASE`.

### Orchestrated mode

The branch and worktree already exist. Inspect:

```bash
git rev-parse --show-toplevel
git branch --show-current
git status --short --branch
```

Require: the checked-out branch is the assigned slice branch (never `$BASE`), the worktree is dedicated to this slice, and no unexplained pre-existing application-code changes exist.

Verify bootstrap:

```bash
test -f .env.local
test -d node_modules
git check-ignore -q .env.local
```

Treat `.env.local` as secret: keep it out of prompts, logs, and commits.

If bootstrap is incomplete, report:

```text
BLOCKED: slice #<N> worktree bootstrap incomplete: <reason>
```

Never create a replacement worktree or run another bootstrap yourself.

### Standalone mode

```bash
git checkout -b "ticket-<N>-<slug>" "origin/$BASE"
```

Ensure a runnable checkout: `pnpm install --frozen-lockfile` when dependencies are missing.

Done when: exactly one dedicated slice branch is checked out in a runnable worktree, and `$BASE`/`$BASE_SHA` are recorded.

## 3. Read repository guidance

Follow the repo reference chain before editing: `CONTEXT-MAP.md` → feature `CONTEXT.md` → `docs/adr/` → OpenSpec artifacts. Invoke ticket-required skills before work in their domain (e.g. `/supabase`, `/supabase-postgres-best-practices`, `/tdd`, `/next-best-practices`, `/shadcn`). For database work, follow both Supabase skills when the repository requires them.

Reuse the project's existing architecture and vocabulary; a second convention beside an established one needs a specification-level reason.

Done when: applicable conventions, domain rules, and required skills are loaded.

## 4. Implement the slice

Implement this ticket's complete vertical behavior, cutting through every layer it genuinely needs — schema/data, server logic, validation, authorization, API/server actions, UI, tests. Do not force layers the behavior does not need.

Production bar: no temporary bypasses, debug-only production behavior, TODOs for required functionality, knowingly broken error handling, client-only authorization, or unsafe migrations. Preserve validation at trust boundaries, authorization invariants, security/privacy requirements, data integrity, existing domain terminology, and expected failure behavior.

Use the narrowest implementation that satisfies the accepted spec.

Run focused checks while implementing (`pnpm vitest run <relevant-test>`); do not wait until the end to discover basic breakage.

If the slice requires a genuine specification decision, stop and report:

```text
BLOCKED: issue #<N>
Decision required: <specific unresolved decision>
Why it matters: <implementation consequence>
Recommended: <recommended choice>
```

Do not invent product behavior.

Done when: every acceptance criterion is implemented, focused tests pass, and no known slice-owned behavior remains incomplete.

## 5. Verify the implementation

```bash
pnpm test
pnpm lint
pnpm build
```

When repository CI requires it, reproduce the Fallow gate:

```bash
pnpm exec tsx scripts/run-fallow-audit.ts "$BASE_SHA"
```

Trace findings before changing code; fix only new findings caused by this slice.

### Database slices

Follow `/supabase` and the repository's Prisma/Supabase migration workflow: verify demo-target isolation, run the dry-run push and read-only preflight counts before any destructive migration, then push, regenerate types, and re-seed idempotently. Applied migrations are frozen — corrections ship as new migration files.

If `@prisma/client` types are stale after a model edit, delete the store `.prisma` dir and regenerate before treating type failures as application bugs.

Done when: every required verification command passes, and migration preflight counts are recorded for the PR body.

## 6. Run the code-review loop

Invoke `/code-review` against `origin/$BASE`. The implementation agent must not substitute its own self-review for the required workflow.

Accept or reject every finding. Accepted findings get fixed. Rejections need concise rationale: incorrect, explicitly required, out-of-slice, or owned by another ticket. A finding may be deferred only when another known ticket owns the work — never as a way to ship a known slice defect.

After material fixes, rerun `pnpm test`, `pnpm lint`, `pnpm build`, then `/code-review` again. Repeat until a verified round has no accepted unresolved findings.

Done when: the last review round is clean, all accepted findings are resolved, verification passes after the final material change, and every rejection/deferral rationale is recorded.

## 7. Commit the slice

Commit in logical groups with conventional messages; use `/git-commit` when available. Do not fold unrelated cleanup into this slice.

Before pushing:

```bash
git status
git diff
git log --oneline "origin/$BASE"..HEAD
```

Done when: all intended work is committed and the working tree holds no unexpected application-code changes.

## 8. Synchronize before the first push

Run the synchronization recipe's staleness check. If `git rev-list --count HEAD.."origin/$BASE"` is greater than zero, run the recipe.

Done when: the branch contains the current integration base and remains verified.

## 9. Push and create the PR

Push with `git push -u origin HEAD`.

Create exactly one PR for this slice. It must:

- target `$BASE`
- contain `Closes #<N>`
- identify the parent tracker where useful
- summarize delivered behavior
- record verification evidence and code-review status
- record justified rejected/deferred findings
- note migration/preflight evidence for DB slices

A rebase rewrites pushed history — update the existing PR; never create a second one.

Done when: exactly one open PR represents this slice.

## 10. Babysit CI and reviews

```bash
gh pr checks <PR>
```

Keep working until required CI, required checks, Greptile findings, code-review findings, and human review comments are resolved. Pending checks are not completion.

After material fixes post-PR: rerun focused tests, `pnpm test`, `pnpm lint`, `pnpm build`, rerun `/code-review`, push, and wait for fresh CI/review state.

Done when: required CI is green, required review gates pass, required comments are resolved, and no known slice correctness issue remains.

## 11. Final synchronization gate

Green CI does not mean the branch is current. Run the synchronization recipe's readiness check (`git merge-base --is-ancestor "origin/$BASE" HEAD`).

- **Current** — proceed to finish.
- **Stale** — run the synchronization recipe, then re-run the readiness check.

Do not declare `MERGE_READY` while stale.

## 12. Finish

### Orchestrated mode

Do NOT merge. Resolve the PR number and actual remote head SHA, verify it is the current PR head, and report exactly:

```text
MERGE_READY: issue #<N>, PR #<P>, head <sha>
```

Then wait for the orchestrator, which owns the merge, worktree cleanup, child/parent closing, and any next slice.

If the orchestrator revokes readiness because `origin/$BASE` advanced, run the synchronization recipe and report a NEW:

```text
MERGE_READY: issue #<N>, PR #<P>, head <new-sha>
```

Old readiness is invalid once the base advances beyond it.

If this worker session is interrupted, leave Git and worktree state intact — the orchestrator owns recovery and may resume this same worktree.

Done when: `MERGE_READY` is reported with the current PR head, and the PR is intentionally unmerged.

### Standalone mode

Fetch `$BASE` once more and require `git merge-base --is-ancestor "origin/$BASE" HEAD`; if stale, run the synchronization recipe and re-check.

When current, green, reviewed, and comment-resolved, merge using the repository's established PR strategy. Confirm through GitHub that the PR is merged and issue #<N> is completed; leave the parent untouched.

Done when: the slice is merged into the integration branch.
