## Why

Cohold's front-end foundation is in place, but the MVP cannot be declared
demo-ready until the Soroban contract is exercised on live Stellar Testnet
with reproducible evidence: deployed treasuries, wallet-driven flows,
isolation and negative results, and an auditable readiness record.

## What Changes

- Extract the treasury contract into a standalone Rust crate and keep the
  generated bindings behind the `contract-adapter` / `contribute-flow` /
  `proposal-flow` seams.
- Deploy two initialized independent Testnet treasury instances from the
  reviewed Wasm and record a secret-free manifest (`deployments/testnet.json`)
  with git SHA, Wasm hash, network, token id, contract ids, identities,
  members, and thresholds.
- Deliver live Testnet flows through the UI's own flow modules: contribute,
  create proposal (creation is approval #1), approve, permissionless execute,
  plus fail-closed wallet diagnostics.
- Prove the readiness-guide negatives and cross-treasury isolation with an
  opt-in live matrix, and record a canonical acceptance walkthrough with every
  transaction hash and before/after balance in `docs/mvp-acceptance.md`.
- Add a package `verify` script that covers the documented local verification
  loop without `npm run build` (build rewrites `.next` and breaks dev-server
  HMR inside agent sessions).
- Keep the OpenSpec change unarchived as the acceptance record; `openspec
  validate cohold-testnet-mvp-completion` must be green.

## Capabilities

### New Capabilities

- `testnet-mvp-deployment`: One deployed contract instance equals one
  treasury; two initialized instances with independent members/thresholds,
  a secret-free manifest, and live drift guards between manifest and chain.
- `testnet-mvp-acceptance`: The reproducible readiness record — the canonical
  funded→proposed→approved→executed walkthrough with hashes and balances,
  the isolation/negatives matrix, the `verify` script for the documented
  local loop, readiness docs consistent with one-instance-one-treasury and
  approval-count semantics, and the OpenSpec validation gate.

### Modified Capabilities

- None. The foundation capabilities (`nextjs-app-shell`,
  `stellar-transaction-flow`, `contract-authoritative-read-model`,
  `demo-development-mode`) keep their requirement sets; this change builds on
  them without changing their contracts.

## Impact

- `packages/cohold-contract` — generated bindings for the standalone crate
  (behind the adapter seam; UI never imports it directly).
- `src/lib` — `contract-adapter`, `contribute-flow`, `proposal-flow`,
  `wallet-diagnostics`, `testnet-matrix-gate`, live Testnet suites
  (`proposal-flow.testnet.test.ts`, `isolation-negative.testnet.test.ts`,
  `mvp-walkthrough.testnet.test.ts`).
- `scripts/testnet-bootstrap.mjs`, `scripts/testnet-matrix.mjs`, package.json
  scripts (`verify`, `test:walkthrough`, `test:testnet`,
  `contract:bindings`), `.github/workflows/ci.yml`, `testnet-live.yml`.
- `deployments/testnet.json`, `deployments/walkthrough.json` — secret-free
  evidence manifests.
- `docs/mvp-acceptance.md`, `docs/cohold-mvp-readiness-guide.md`,
  `docs/cohold-runbook.md`, `docs/deploy-testnet.md`, `docs/cohold-srs.md`.
- Live Testnet runs stay protected: workflow_dispatch-only, secrets in the
  repository, never a required public PR check.