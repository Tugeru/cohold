# Supervise

Load this file only when the user asked to supervise, monitor, or wait on the wave. This session only coordinates; workers run `/ship-slice`.

Invoke `/orchestration` and follow its current guide. Create one Run for the parent. Create one Task per frontier ticket, then `worker-start` each into a new top-level worktree with the call's `--agent`, and `--model` / `--effort` when named. The injected spec is the sibling baton from [LAUNCH.md](LAUNCH.md) plus "send `worker_done` when `/ship-slice` has merged the ticket."

Wait with `check --wait` until every Dispatch in the wave settles. Re-survey (SURVEY.md). Another frontier → another wave of Tasks. No open children → the relay is over. Frontier empty, open children remain → name each as claimed or blocked and stop.

