---
name: ship-slice
description: Ship one vertical slice — a GitHub issue cutting a parent spec into a mergeable increment — from ticket to merged main.
argument-hint: "Which issue/ticket number is the slice?"
disable-model-invocation: true
---

# Ship Slice

Ship one vertical slice from ticket to merged `main`: orient, cut the branch, build, review loop, verify, ship. Run the steps in order; each step's `Done when` criterion is met before the next begins. A parent of many slices is `/slice-relay`.

## 1. Orient the slice

- `gh issue view <N>` for the ticket, then its parent issue. The ticket's acceptance criteria are the contract; the parent's vertical-slice plan names what belongs to later slices.
- Read the OpenSpec change the ticket points at (`openspec/changes/<name>/`): `tasks.md` for the slice's task and commit hints, `specs/` for capability specs.
- Confirm every `Blocked by` issue is closed. Stop and hand back if not. If this ticket itself has open sub-issues, it is a parent — stop and point at `/slice-relay`.
- Map every acceptance criterion to the files that will implement it.

Done when: every acceptance criterion has an owning change, and every deliberately deferred item is named with the ticket that owns it.

## 2. Cut the branch

- `git fetch origin`, then branch from `origin/main` — never a stale local `main`, which may be checked out in another worktree: `git checkout -b Tugeru/ticket-<N>-<slug> origin/main`.

Done when: the branch is checked out, based on the integration base that contains all merged blockers.

## 3. Build the slice

- Follow the repo reference chain (AGENTS.md → CONTEXT-MAP.md → feature CONTEXT.md → ADRs) before editing.
- Extend existing seams; a second convention beside an existing one is forbidden.
- Work in logical groups matching the OpenSpec task commit hints — each group becomes one commit later.
- Run the ticket's required skills (e.g. `/supabase` before migration work, `/tdd` at pre-agreed seams).

Done when: focused tests pass and changed files are typecheck and lint clean.

## 4. Run the review loop

- `/code-review` against `origin/main`; it runs Standards and Spec as parallel read-only subagents.
- Accept or reject every finding. Accepted findings get fixed. Rejected ones must be out-of-slice per the parent's plan — record the rationale now; it ships in the PR body.
- Material changes restart the loop. Repeat until a round reports no accepted findings.

Done when: the last round is clean on both axes and every rejection rationale is written down.

## 5. Verify

- `pnpm test`, `pnpm lint`, `pnpm build`.
- Reproduce the CI fallow gate locally: `pnpm exec tsx scripts/run-fallow-audit.ts <base-sha>`; trace findings before fixing, fix only new findings in changed files.
- DB slice: verify demo-target isolation, dry-run the push, read-only preflight counts before any destructive migration, then push, regenerate types, and re-seed idempotently. Applied migrations are frozen — fixes ship as new migration files.
- Prisma enums missing from `@prisma/client` types after a model edit means a stale client: delete the store `.prisma` dir and regenerate.

Done when: every command passes and migration preflight counts are recorded for the PR body.

## 6. Ship

- Commit the logical groups from step 3 with conventional messages (`/git-commit`).
- Push; open the PR with `Closes #<N>` and a body recording the review loop, deferred findings, and verification evidence.
- Poll `gh pr checks` until green; resolve every review comment, bot and human, before merging.
- Merge to `main`; leave the parent issue untouched. If this session is a slice-relay, return to it. Otherwise name the parent's remaining open unblocked children and stop.

Done when: the slice is on `main`, the ticket is closed as completed, and no PR comments remain open.
