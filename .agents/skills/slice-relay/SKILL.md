---
name: slice-relay
description: Relay a parent GitHub tracker through its vertical slices — one session, one slice, baton on.
argument-hint: "<parent-issue> <agent> [model] [effort]"
disable-model-invocation: true
---

# Slice Relay

A **relay**: this session ships one vertical slice of a parent tracker, then passes the **baton**. Sibling **frontier** tickets get their own worktrees. The relay is over when every child of the parent is closed.

`/ship-slice` ships. This skill chooses, claims, fans out, and continues.

## 1. Read the call

Take from the invocation or the baton that started this session:

- **parent** — tracker issue number
- **agent** — coding agent for every launch this run (`omp` / `oh-my-pi`, `pi`, `opencode`, or another Orca `--agent` id)
- **model**, **effort** — optional; copy onto every baton
- **claimed slice** — optional; the ticket this session already owns

Stop and ask if parent or agent is missing.

Done when: parent, agent, and any model/effort/claimed-slice are written down.

## 2. Survey the frontier

Load [SURVEY.md](SURVEY.md) and run its query on the given number. If `parent` is set, that parent is the tracker and the given number is the claimed slice — re-run the query on the parent. Classify every open child.

The **frontier** is the open children with no open blocker and no live claim.

- No open children → the relay is over. Stop.
- Open children, empty frontier → name who holds each claim or blocker and stop.

Done when: every open child is tagged frontier, claimed, or blocked, each with the evidence in SURVEY.md.

## 3. Claim the wave

A **claim** is the first write on a ticket. Post, assign, and resolve races per SURVEY.md.

- Baton named a claimed slice that is still open, unblocked, and this worktree's (or unclaimed) → keep it.
- Otherwise claim the first frontier ticket in parent order. That is this session's slice.
- Claim every remaining frontier ticket. For each, launch a sibling worktree per [LAUNCH.md](LAUNCH.md) whose baton names that ticket as the claimed slice.

The blocking graph is the parallelism contract: every frontier ticket is parallel.

If the user asked to supervise, monitor, or wait on the wave, load [SUPERVISE.md](SUPERVISE.md) instead of launching full handoffs.

Set the active worktree comment to `relay: shipping #<slice> of #<parent>`.

Done when: this session's ticket is this worktree's live claim, and every other frontier ticket is either a launched sibling (baton delivered) or still unclaimed with a written reason.

## 4. Ship

Run `/ship-slice` on this session's ticket.

Done when: `/ship-slice`'s Done when is met for this session's ticket.

## 5. Pass the baton

Re-run the survey in SURVEY.md.

- No open children → the relay is over. Stop.
- Frontier remains → claim every frontier ticket; launch one worktree per claim (LAUNCH.md). This session keeps none. Deliver each baton and stop monitoring.
- Frontier empty, open children remain → name each as claimed or blocked and stop.

Done when: one of those three exits is taken, and every baton launch (if any) carries the same parent, agent, model, and effort as this call.
