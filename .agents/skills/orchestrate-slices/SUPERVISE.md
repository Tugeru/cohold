# Supervision and Merge Gate

Load this file after one or two slice workers are active.

The orchestrator supervises; workers implement. Never solve application-code problems from the orchestrator session.

## 1. Observe lifecycle state

Wait on Herdr agent state, never shell sleep loops:

```bash
herdr agent wait "slice-<issue>" --timeout 30000
```

Without `--until`, `agent wait` settles on `idle`, `done`, or `blocked`. The timeout is a supervision heartbeat, not evidence the worker failed. Read the state:

```bash
herdr agent get "slice-<issue>"
```

With two active workers, rotate between them after each event or heartbeat. After each event refresh:

```bash
git fetch origin "$BASE"
CURRENT_BASE_SHA="$(git rev-parse "origin/$BASE")"
```

## 2. Working

Leave a `working` worker alone. Do not repeatedly ask for progress. Do not interrupt a healthy implementation merely because `origin/<base>` advanced — freshness is enforced at the merge gate.

## 3. Blocked

Read recent output:

```bash
herdr agent read "slice-<issue>" --source recent-unwrapped --lines 120
```

Worker-owned problems — failing tests, type errors, lint failures, ordinary implementation bugs, CI failures, code-review and Greptile findings, ordinary Git conflicts, a stale branch — stay with the worker; prompt it to continue. Do not surface routine engineering problems to the user.

Surface a blocker only when it requires a genuine decision: ambiguous product behavior, an unresolved domain rule, a security/privacy boundary, destructive-operation approval, a material specification contradiction, or two accepted designs that cannot coexist.

Other independent workers continue while one waits for a user decision.

## 4. Idle or done

`idle` or `done` does not mean the slice is complete. Inspect GitHub: require an actual PR and the completed `/ship-slice` contract. If not, prompt:

```text
Continue /ship-slice <issue> orchestrated from the earliest incomplete gate.
Do not stop until the PR is fully merge-ready or a genuine user decision is required.
```

## 5. MERGE_READY contract

Expected worker report:

```text
MERGE_READY: issue #<issue>, PR #<pr>, head <sha>
```

Treat it as a request for merge evaluation, not proof. The orchestrator independently verifies every gate.

## 6. Verify PR state

```bash
gh pr view <PR>
gh pr checks <PR>
```

Merge only when every gate holds:

- PR is open
- PR belongs to the expected child issue
- PR targets `$BASE`
- actual head SHA matches the worker report
- required CI is green
- required reviews are satisfied
- required review comments are resolved
- child issue remains open
- no known correctness issue remains

If any gate fails, do not merge — send the PR back to the worker.

## 7. Serialize merge evaluation

Only one worker may be inside the final merge gate at a time. If both workers are MERGE_READY, choose one deterministically, preferring:

1. tracker order
2. the dependency-defining slice
3. the earlier READY slice

The second worker waits. Never merge two PRs concurrently.

## 8. Freshness gate

```bash
git fetch origin "$BASE"
CURRENT_BASE_SHA="$(git rev-parse "origin/$BASE")"
```

Require the PR head to contain the current base:

```bash
git merge-base --is-ancestor "origin/$BASE" "<pr-head-sha>"
```

On success, continue. On failure, merge readiness is revoked. Prompt the worker:

```text
MERGE_READY revoked.

origin/<base> advanced to <base-sha> and your PR head does not contain it.

Rebase this slice onto the current origin/<base>. Resolve conflicts according to
the accepted OpenSpec design and current integration behavior. Then rerun the
required tests, pnpm test, pnpm lint, pnpm build, and /code-review when the
rebase materially changed implementation. Push with --force-with-lease if
history changed, wait for fresh CI and review results, and report a new:

MERGE_READY: issue #<issue>, PR #<pr>, head <new-sha>
```

The worker remains ACTIVE and keeps consuming its worktree slot.

## 9. Final race check

Immediately before merge, fetch and run the freshness check again. If the base advanced since the previous check, do not merge — return the PR to the worker.

## 10. Merge

Use the repository's established PR merge strategy; do not invent a new merge policy. Merge exactly one PR, then confirm through GitHub that it is actually merged.

```bash
git fetch origin "$BASE"
NEW_BASE_SHA="$(git rev-parse "origin/$BASE")"
```

Require the integration branch to contain the merged PR. Confirm the child issue is completed through the PR's `Closes #<issue>` relationship, or close it only when completion is independently verified. Never close the parent here.

## 11. Cleanup after merge

Load WORKTREES.md and clean only the successfully merged slice's worktree. Once removal is verified, its slot is free.

The other active slice remains alive; its PR may now be stale because the integration branch advanced. Do not immediately interrupt it if it is still implementing — its next MERGE_READY evaluation enforces freshness.

## 12. Recompute

Return to SKILL.md and re-run steps 3–6 with current GitHub and Herdr state. Fill at most the newly available worktree slot. Never exceed two active slice worktrees.
