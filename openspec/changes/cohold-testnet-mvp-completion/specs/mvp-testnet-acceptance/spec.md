## ADDED Requirements

### Requirement: Live Testnet happy path
A recorded Testnet acceptance run SHALL demonstrate Freighter (or equivalent Testnet signers) connecting on Testnet, opening the configured primary treasury, contributing native XLM, creating a proposal that starts at `1 / N` with the proposer approved, collecting remaining approvals, executing the payment, and verifying the recipient and treasury balance deltas.

#### Scenario: Contribution confirms on Testnet
- **WHEN** member A contributes a positive XLM amount to Contract A
- **THEN** the transaction SHALL confirm on Testnet
- **AND** a subsequent `get_balance` SHALL increase by exactly that amount

#### Scenario: Proposal starts at one approval
- **WHEN** member A creates a proposal after the treasury is funded
- **THEN** the confirmed proposal SHALL be `Pending` (or `Approved` if threshold is 1)
- **AND** A SHALL be recorded as approved with `approval_count = 1`

#### Scenario: Threshold execution transfers exact amount
- **WHEN** the proposal reaches threshold and execute confirms
- **THEN** proposal status SHALL be `Executed`
- **AND** treasury balance SHALL decrease by exactly the proposal amount
- **AND** recipient token balance SHALL increase by exactly the proposal amount

### Requirement: Negative security matrix on deployed contracts
The live suite SHALL exercise wrong-network blocking, signature rejection with no state change, outsider contribute/propose/approve rejection, duplicate approval rejection, under-threshold execute rejection, insufficient-balance execute rejection that leaves the proposal `Approved`, double execute rejection, and competing proposals that cannot overspend the remaining balance.

#### Scenario: Outsider writes are rejected by the contract
- **WHEN** outsider E contributes, creates a proposal, or approves on Contract A
- **THEN** each invocation SHALL fail with `NotMember`
- **AND** treasury balance and proposal state SHALL remain unchanged

#### Scenario: Duplicate approval is rejected
- **WHEN** member B approves a proposal a second time
- **THEN** the contract SHALL reject with `AlreadyApproved`
- **AND** `approval_count` SHALL remain unchanged

#### Scenario: Under-threshold execute is rejected
- **WHEN** execute is submitted at `2 / 3` on a threshold-3 treasury
- **THEN** the contract SHALL reject with `ThresholdNotReached`
- **AND** the proposal SHALL remain unexecuted

#### Scenario: Failed over-balance execute stays unexecuted
- **WHEN** an `Approved` proposal whose amount exceeds Contract A balance is executed
- **THEN** the contract SHALL reject with `InsufficientBalance`
- **AND** a re-read SHALL show the proposal still `Approved`

#### Scenario: Double execute is rejected
- **WHEN** execute is submitted again after a successful execution
- **THEN** the contract SHALL reject with `AlreadyExecuted`
- **AND** balances SHALL not change a second time

### Requirement: Cross-treasury isolation on two instances
Acceptance SHALL fund Contract B independently and construct an approved proposal on Contract A whose amount exceeds A's balance but is less than A+B. Execution on A SHALL fail. B's funds SHALL not move.

#### Scenario: Contract A cannot spend Contract B
- **WHEN** Contract A has balance `A_balance`, Contract B has balance `B_balance`, and an approved proposal on A requests `A_balance < amount < A_balance + B_balance`
- **THEN** execute on A SHALL fail with `InsufficientBalance`
- **AND** Contract B's balance SHALL be unchanged

### Requirement: Permissionless execute remains enforced
If product artifacts retain permissionless execute after approval, the live suite SHALL confirm that a non-member caller can submit execute for an already-approved, solvent proposal without being able to change its terms.

#### Scenario: Non-member executes an approved proposal
- **WHEN** a funded non-member submits execute for an `Approved` proposal with sufficient treasury balance
- **THEN** the transfer SHALL succeed to the stored recipient for the stored amount
- **AND** a caller-supplied alternate recipient or amount SHALL be ignored because those fields are not arguments

### Requirement: Recorded acceptance evidence
Declaring the MVP demo-ready SHALL require a committed evidence document that records git revision, Wasm hash, network, both contract IDs, token SAC ID, member and recipient addresses, thresholds, relevant transaction hashes, treasury and recipient balances before and after execution, negative-case results, CI results, and the manual Freighter walkthrough result. A bare `PASS` line SHALL NOT be sufficient.

#### Scenario: Evidence file can reproduce the run
- **WHEN** a reviewer opens the acceptance evidence document
- **THEN** they SHALL be able to identify the Wasm, contract IDs, and transaction hashes used
- **AND** they SHALL see expected versus actual results for the isolation and negative cases

### Requirement: CI gates are split by flakiness
Every pull request SHALL run frontend lint, typecheck, tests, and build, plus contract `cargo test` and `stellar contract build`, plus a binding-compatibility check. Live Testnet acceptance SHALL be a manual or protected workflow and SHALL NOT be a required public PR check. The live workflow SHALL be green before the MVP is declared demo-ready.

#### Scenario: Pull request does not depend on Testnet
- **WHEN** a pull request runs CI
- **THEN** frontend and contract-local gates SHALL run
- **AND** a Testnet RPC outage SHALL NOT fail the required PR checks

#### Scenario: Binding drift fails CI
- **WHEN** the Rust contract interface changes without updating committed bindings
- **THEN** the binding-compatibility gate SHALL fail
- **AND** the frontend adapter SHALL not be mergeable against stale types

#### Scenario: Pre-demo live workflow is required for readiness
- **WHEN** an operator claims the MVP is demo-ready
- **THEN** the manual Testnet acceptance workflow SHALL have passed against the recorded contract IDs
- **AND** the evidence document SHALL be updated for that run
