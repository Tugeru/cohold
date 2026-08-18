# cohold-testnet-mvp-completion — Tasks

Completion tracker for the Testnet MVP. Groups 1–8 shipped as vertical
slices (merged to `main`); group 9 is the live acceptance matrix and the
readiness record.

## 1. Contract extraction

- [x] 1.1 Extract the Cohold treasury contract into a standalone Rust crate
      with its own contract tests

## 2. Demo guard rename

- [x] 2.1 Rename the demo mutation guard and keep it demo-only

## 3. Contract invariants

- [x] 3.1 Add the contract invariant test suite (one approval per member,
      threshold gating, insufficient balance, double execute,
      cross-treasury isolation)

## 4. Bindings and adapter cutover

- [x] 4.1 Generate contract bindings from the built Wasm
- [x] 4.2 Cut over `contract-adapter` / `contribute-flow` / `proposal-flow`
      to the generated bindings; UI must not import
      `packages/cohold-contract` directly

## 5. Testnet deployment

- [x] 5.1 Add `scripts/testnet-bootstrap.mjs`: build + hash Wasm, resolve
      the native XLM SAC, deploy and initialize two treasury instances,
      record the secret-free manifest
- [x] 5.2 Deploy treasury A (IT Society Event Fund, 4 members, threshold 3)
      and treasury B (Capstone Project Fund, 3 members, threshold 2); record
      `deployments/testnet.json`

## 6. Fail-closed wallet diagnostics

- [x] 6.1 Add fail-closed wallet/network diagnostics (unreachable or
      unhealthy RPC, wrong network, missing contract ids) that block
      state-changing actions

## 7. Contribute on Testnet

- [x] 7.1 Contribute smoke: member funds a treasury through the flow modules
      against a live contract; balance re-read from RPC

## 8. Propose, approve, execute on Testnet

- [x] 8.1 Create proposal and approve on Testnet (creation records
      approval #1; `approval_count = 1` at create; exact-threshold
      transition to `Approved`; NotMember / AlreadyApproved /
      ProposalNotPending negatives)
- [x] 8.2 Execute payment on Testnet (permissionless execute, exact amount
      to exact recipient, balance debit, stale-confirmation handling)

## 9. Isolation matrix and acceptance evidence

- [x] 9.1 Add the gated live isolation and negatives matrix
      (`src/lib/isolation-negative.testnet.test.ts`, `npm run test:testnet`):
      outsider writes, duplicate approval, under-threshold execute, approved
      over-balance execute leaving the proposal `Approved`, double execute,
      competing proposals, wrong-network and wrong-actor signatures, wallet
      cancel, permissionless execute by a non-member fee-payer, and
      cross-treasury isolation
- [x] 9.2 Add the matrix runner and gate (`scripts/testnet-matrix.mjs`,
      `resolveMatrixGate`) that refuse to run with missing/malformed
      secrets or a drifting manifest; add the protected
      `testnet-live.yml` workflow
- [x] 9.3 Add a package `verify` script covering the documented local loop
      (lint, typecheck, unit tests) that does not run `npm run build`;
      document the agent-safe loop in the runbook
- [x] 9.4 Keep SRS wording consistent with one instance = one treasury
      (isolation invariant) and remove `0 / N` proposal starts from
      readiness/demo docs; state that creation records the proposer's
      approval (start at 1 of N)
- [x] 9.5 Record `docs/mvp-acceptance.md`: deployment git SHA, Wasm hash,
      network, both contract ids, token id, members, thresholds, walkthrough
      tx hashes, before/after balances, negatives, and CI results
- [x] 9.6 Record the canonical Freighter walkthrough (connect → fund →
      propose → 2/3 reject execute → 3/3 execute → verify → reject double
      execute) and capture the evidence to `deployments/walkthrough.json`
      via `src/lib/mvp-walkthrough.testnet.test.ts`
- [x] 9.7 Keep `openspec validate cohold-testnet-mvp-completion` green;
      leave the change unarchived until the acceptance criteria are met