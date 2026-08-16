# Survey

The GraphQL fields are the source of truth for children; body text is the fallback when `subIssues` is empty.

## Children

Resolve owner/repo with `gh repo view --json nameWithOwner`. Run with `gh api graphql -F owner -F name -F number`:

```graphql
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      number
      title
      state
      parent { number title }
      subIssues(first: 50) {
        pageInfo { hasNextPage endCursor }
        nodes {
          number
          title
          state
          issueDependenciesSummary { blockedBy }
          blockedBy(first: 20) { nodes { number title state } }
        }
      }
    }
  }
}
```

Follow `endCursor` until `hasNextPage` is false so every child is listed.

If `subIssues.nodes` is empty, collect children from every task-list issue ref (`#N`) in the parent body and from issues whose body starts with `Part of #<parent>`. A checkbox is not state — `gh issue view` is.

## Blockers

A child is **blocked** when `issueDependenciesSummary.blockedBy > 0`, any `blockedBy.nodes` entry is `OPEN`, or `## Blocked by` names an issue that is still open. `None — can start immediately` is not a blocker.

## Claims

Worktree id: invoke `/orca-cli`, then `worktree current --json` → `.id`. Outside Orca, use `hostname:pwd`.

**Post a claim**

```text
<!-- slice-relay-claim -->
claimed by worktree `<id>` on parent #<parent>
```

Then `gh issue edit <n> --add-assignee @me`. Re-fetch comments immediately. The earliest `<!-- slice-relay-claim -->` with no later `<!-- slice-relay-release -->` from the same worktree is live. A later claim posts a release on its own comment and leaves the ticket.

**Release** (backed-off claim, or a launch that never got a baton):

```text
<!-- slice-relay-release -->
released by worktree `<id>`
```

A live claim dies when the issue closes.

## Tags

For each open child, exactly one:

| Tag | Evidence |
| --- | --- |
| blocked | an open native blocker, or an open issue in `## Blocked by` |
| claimed | a live claim comment |
| frontier | neither |

List the set in parent order (sub-issue order, else task-list order).
