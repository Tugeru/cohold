# Launch

A launch is a full handoff: new independent worktree, baton delivered, then this session stops watching that worker. Invoke `/orca-cli` and follow its current guide before any Orca command.

## Agent

Map the call's agent onto Orca's `--agent` id:

| said | `--agent` |
| --- | --- |
| `omp`, `oh-my-pi`, `oh my pi` | `omp` |
| `pi` | `pi` |
| `opencode` | `opencode` |
| anything else | the id as given |

Copy **model** and **effort** into the baton. Use `worktree create --agent <id> --prompt` when that launches the agent. Take the two-step custom-argv path in the orca-cli guide only when the user named launch flags `--agent` cannot take.

## Worktree

Each slice is its own PR off the repo default base. Create an independent top-level worktree: `--no-parent`, omit `--base-branch`, `--setup run`, `--agent <id> --prompt "<baton>"`, name `slice-<N>-<slug>`.

If Orca cannot launch, leave that ticket claimed only if a worker actually has the baton. Otherwise release the claim and record `Orca unavailable` as the reason — this session still ships its own slice.

## Baton

The baton starts with the slash so the next agent user-invokes this skill. Include the `Claimed slice` line only when this launch already owns a ticket (step 3 siblings). Step 5 omits it so the next leg surveys.

```text
/slice-relay <parent> <agent> <model> <effort>

You are a leg of a slice relay on parent #<parent> (<parent title>).
Claimed slice: #<N> (<slice title>).
Close only the claimed slice ticket; the parent stays open.

Invoke /slice-relay with the arguments above, then follow it.
```

Drop the `model` / `effort` tokens when the call did not name them. One launch per claimed ticket; the receipt's `worktree.id` is the proof the baton was delivered.
