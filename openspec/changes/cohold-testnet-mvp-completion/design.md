# cohold-testnet-mvp-completion — Design

## Context

Cohold's foundation slice established the App Router shell, the
Freighter/Testnet transaction lifecycle, the RPC-authoritative read model,
and the demo boundary. This change completes the Testnet MVP: the contract
shipped as a standalone Rust crate with generated bindings behind the
adapter seam, two treasuries are deployed and initialized on live Testnet,
wallet flows (contribute, propose with creation-as-approval-#1, approve,
permissionless execute) run against those instances, and the readiness
record (`docs/mvp-acceptance.md`) carries reproducible evidence rather than
a bare pass.

Constraints from the MVP tracker (locked decisions):

- One contract instance = one treasury. No factory; wallet-mode Create
  Treasury stays out of scope.
- `create_proposal` is Approval #1 (`approval_count = 1`; immediately
  `Approved` when threshold is 1).
- Execute is permissionless once `Approved` (fee-payer auth only; terms
  immutable).
- Generated bindings stay behind `contract-adapter` / `contribute-flow` /
  `proposal-flow`; the UI never imports `packages/cohold-contract`.
- `isDemoMutationAllowed()` remains demo-only; fixture DB writes never
  count in wallet mode.
- Live Testnet acceptance is a protected/manual workflow, never a required
  public PR check.

## Goals / Non-Goals

Goals:

- Two deployed, initialized treasury instances with a secret-free manifest.
- A live isolation/negatives matrix that proves the readiness-guide blocked
  flows and cross-treasury isolation.
- A canonical walkthrough whose evidence (hashes, balances, rejections) is
  recorded and reproducible.
- Docs consistent with the locked semantics (1 of N start, one instance =
  one treasury) and a `verify` script covering the documented local loop
  without a build.
- `openspec validate cohold-testnet-mvp-completion` green.

Non-goals: factory/deploy-from-UI, Mainnet, dynamic membership or
thresholds, fiat rails, receipts/notifications, making live Testnet a CI
gate.

## Decisions

- **Decision: one deployed instance per treasury.** Two instances (A: 4
  members / 3 threshold, B: 3 members / 2 threshold) are deployed from the
  same reviewed Wasm. Isolation between them is asserted live.
  Alternative considered: a factory with per-treasury sub-accounts —
  rejected as MVP scope creep and a larger contract surface.

- **Decision: identity and secrets split.** Public keys live in the
  committed manifest; secrets live only in the stellar CLI keyring
  (`~/.config/stellar`) and CI repository secrets. Live suites read
  secret values from the environment (`COHOLD_TESTNET_SECRET_*`) and skip
  themselves when any is missing. Alternative: committed dev keys —
  rejected: they would normalize secret material in the repo.

- **Decision: live evidence is machine-captured, not transcribed.** The
  walkthrough suite (`src/lib/mvp-walkthrough.testnet.test.ts`) drives the
  same flow modules the UI uses and writes `deployments/walkthrough.json`
  (hashes, balances, rejections, ids). `docs/mvp-acceptance.md` quotes that
  file; re-runs diff against it. Alternative: hand-typed evidence — rejected:
  not auditable and rots.

- **Decision: `npm run verify` = lint + typecheck + unit tests.** The
  documented loop is covered without `npm run build`, because builds
  rewrite `.next` and break dev-server HMR inside agent sessions. The build
  remains an explicit step and a CI gate. Alternative: including build in
  `verify` — rejected: breaks the agent dev loop it is meant to serve.

- **Decision: live suites are opt-in and separate from CI.** The matrix
  gate (`resolveMatrixGate`) refuses blank/malformed secrets; the GitHub
  workflow is `workflow_dispatch`-only. Alternative: running live Testnet
  in CI — rejected: secrets exposure and network flakiness in public PRs.

## Risks / Trade-offs

- [Testnet RPC ~7-day retention limits history] → Activity/confirmation
  reads stay within the retention window; deep history is out of MVP scope
  (documented in the runbook).
- [Re-runs spend real Testnet XLM] → Walkthrough and matrix are rerun-safe
  (append-only proposals, treasury A refills to a target, competing
  proposal amounts derive from measured balance).
- [Manifest/chain drift after a force re-deploy] → Live suites assert
  on-chain config matches the manifest before any scenario.
- [Friendbot rate limits and Testnet outages] → Environmental; failure
  modes are documented in `deploy-testnet.md`; they do not indicate app
  defects.

## Migration Plan

Already merged slices landed on `main` incrementally. This slice adds the
acceptance record (docs, evidence file, verify script, walkthrough suite)
with no schema or migration surface. Live reruns only write the committed
evidence manifests; a force redeploy requires `--force` on the bootstrap
and archives the previous manifest.

## Open Questions

None. Live acceptance ran on 2026-08-18 with the evidence recorded in
`deployments/walkthrough.json` and `docs/mvp-acceptance.md`.