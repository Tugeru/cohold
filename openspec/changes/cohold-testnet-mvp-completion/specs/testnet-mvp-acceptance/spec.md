# testnet-mvp-acceptance Specification

## Purpose

The testnet-mvp-acceptance capability defines the reproducible readiness
record that lets a reviewer audit the MVP on Stellar Testnet: the canonical
funded→proposed→approved→executed walkthrough with every transaction hash
and before/after balance, the isolation and negatives matrix, a package
`verify` script that covers the documented local loop without `npm run
build`, readiness documentation consistent with the deployed governance
semantics, and a green OpenSpec validation gate that keeps the completion
change unarchived until acceptance is recorded.

## ADDED Requirements

### Requirement: Canonical walkthrough with recorded evidence

The acceptance record SHALL document the canonical walkthrough — connect →
fund → propose → approve to just under threshold → execute rejected →
approve to threshold → execute → verify → double execute rejected — with
every transaction hash, treasury and recipient balances before and after,
and the exact rejection reasons. An opt-in suite SHALL drive the same
sequence through the flow modules the UI uses and write the evidence to a
committed file (`deployments/walkthrough.json`) that the record quotes.

#### Scenario: Reviewer audits the recorded walkthrough

- **WHEN** a reviewer opens `docs/mvp-acceptance.md`
- **THEN** they SHALL find the network, deployment git SHA, Wasm SHA-256,
  token contract id, both treasury contract ids, members, thresholds, and
  every walkthrough transaction hash with before/after balances
- **AND** they SHALL be able to re-run `npm run test:walkthrough` and diff
  the regenerated evidence against the committed record

### Requirement: One approval per member, creation is approval one

Creating a proposal SHALL record the proposer's approval as approval #1;
progress SHALL start at 1 of N required. Readiness and demo documentation
SHALL NOT describe proposals as starting at 0 of N.

#### Scenario: Proposal creation on a live treasury

- **WHEN** a member creates a proposal on a threshold-3 treasury
- **THEN** the created proposal SHALL read back with `approval_count = 1`
  and status `pending`
- **AND** a duplicate approval by the proposer SHALL be rejected

### Requirement: Isolation and negatives matrix

An opt-in live matrix SHALL prove the readiness-guide blocked flows against
the deployed treasuries — outsider writes, duplicate approval, under-
threshold execute, approved over-balance execute leaving the proposal
`Approved`, double execute, competing proposals, wrong-network and wrong-
actor signatures, wallet cancel, permissionless execute by a non-member
fee-payer, and cross-treasury isolation — re-reading contract state as the
source of truth.

#### Scenario: Negative scenario matrix passes

- **WHEN** `npm run test:testnet` runs with the required secret keys
- **THEN** every negative scenario SHALL pass against the live contracts
  and the run SHALL leave balances and proposal state consistent with the
  recorded evidence

### Requirement: Verify script for the documented local loop

The package SHALL expose a `verify` script that runs the documented local
verification loop — lint, typecheck, and unit tests — in order. The script
SHALL NOT run `npm run build`: builds rewrite `.next` and break dev-server
HMR inside long-lived agent sessions; the build stays a separate explicit
step and a CI gate.

#### Scenario: Agent-safe verification

- **WHEN** an agent or developer runs `npm run verify`
- **THEN** ESLint, `tsc --noEmit`, and the Vitest suite SHALL run in order
  without touching `.next` or the running dev server

### Requirement: OpenSpec validation gate

The OpenSpec change tracking the MVP completion SHALL validate green and
SHALL remain unarchived until the acceptance criteria are met and recorded.

#### Scenario: Completion change validates

- **WHEN** `openspec validate cohold-testnet-mvp-completion` runs
- **THEN** the change SHALL validate with no errors
- **AND** the change SHALL not be archived while acceptance evidence is
  outstanding