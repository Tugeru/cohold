# Worktree Lifecycle

Use this reference whenever the orchestrator creates, bootstraps, recovers, or removes a slice worktree.

The orchestrator owns the worktree lifecycle. Workers do not create or delete their own worktrees.

`$ROOT`, `$REPO`, `$BASE`, and `$BASE_SHA` come from SKILL.md step 1.

The installed `herdr` binary is the authority for command syntax and response shapes. Confirm flags with `herdr <command> --help` and read identifiers from JSON responses; never guess field names.

## Hard limit

Before creating anything, count active slice worktrees. If 2 already exist, stop — READY tickets remain queued until a slot frees.

## 1. Refresh the integration base

```bash
git fetch origin "$BASE"
BASE_SHA="$(git rev-parse "origin/$BASE")"
```

Branch from the fetched `origin/$BASE`, never a stale local checkout.

## 2. Create the worktree

```bash
herdr worktree create \
  --cwd "$ROOT" \
  --branch "slice/<issue>-<slug>" \
  --base "origin/$BASE" \
  --label "slice #<issue>" \
  --no-focus \
  --json
```

From the JSON result, retain the workspace ID, root pane ID, worktree path, and branch.

## 3. Bootstrap System CLOIE

Copy the canonical environment:

```bash
SOURCE_ENV="$ROOT/.env.local"
WORKTREE="<returned-worktree-path>"

test -f "$SOURCE_ENV" || { echo "Missing canonical .env.local: $SOURCE_ENV" >&2; exit 1; }
test -d "$WORKTREE" || { echo "Missing worktree: $WORKTREE" >&2; exit 1; }

install -m 600 "$SOURCE_ENV" "$WORKTREE/.env.local"
```

Treat `.env.local` contents as secret: never print, prompt with, log, or commit them.

Verify Git ignores it:

```bash
git -C "$WORKTREE" check-ignore -q .env.local || {
  echo ".env.local is not ignored by Git; refusing worker launch." >&2
  exit 1
}
```

Install dependencies:

```bash
pnpm --dir "$WORKTREE" install --frozen-lockfile
```

No silent fallback to a lockfile-mutating install. If the lockfile is inconsistent, stop and surface the repository problem.

## 4. Bootstrap sanity check

```bash
test -f "$WORKTREE/.env.local"
test -d "$WORKTREE/node_modules"
git -C "$WORKTREE" status --short
```

`.env.local` must not appear in Git status. This establishes a runnable development worktree only — `/ship-slice` owns `pnpm test`, `pnpm lint`, and `pnpm build`.

## 5. Bootstrap failure

If any step fails:

1. Do not start a worker.
2. Do not create another worktree for the same slice.
3. Keep the failed worktree for diagnosis.
4. Report the failed command and shortest useful error.
5. Leave the ticket READY or mark orchestration attention required.

The failed checkout still counts toward the two-worktree ceiling until cleaned up or deliberately removed.

## 6. Recover an interrupted worktree

If the worktree exists but its worker is gone, do not create another one. Inspect:

```bash
git -C "$WORKTREE" status --short --branch
git -C "$WORKTREE" log --oneline -10
```

Inspect GitHub issue and PR state. Verify:

```bash
test -f "$WORKTREE/.env.local"
test -d "$WORKTREE/node_modules"
```

If `.env.local` is missing, copy it as in step 3. Do not overwrite an existing `.env.local` during ordinary recovery. If dependencies are absent, run the frozen install again.

Restart the worker in the existing workspace's root pane (or another available shell pane in that workspace) and prompt:

```text
Resume GitHub slice #<issue> under parent #<parent>.

This is an existing worktree from an interrupted worker. Do not restart the implementation.

Reconstruct current state from:

- git status/log/diff
- GitHub issue
- existing PR
- OpenSpec artifacts
- CI/review state

Continue:

/ship-slice <issue> orchestrated

Do not merge. Stop only at MERGE_READY.
```

Never discard uncommitted work automatically.

## 7. Cleanup

Clean a slice worktree only after GitHub confirms its PR is merged.

```bash
git -C "$WORKTREE" status --short
```

If clean:

```bash
herdr worktree remove --workspace "<workspace-id>" --json
```

Worktree removal deletes the checkout, not the Git branch.

If the checkout is unexpectedly dirty, stop, preserve it, and report the files. Never use `--force` merely to free a concurrency slot.

After removal, verify it no longer appears in `herdr worktree list --cwd "$ROOT" --json`. Only then is the execution slot free.
