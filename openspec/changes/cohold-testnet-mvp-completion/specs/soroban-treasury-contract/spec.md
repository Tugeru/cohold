## ADDED Requirements

### Requirement: Authoritative Rust contract crate
Cohold SHALL maintain a first-class Rust/Soroban crate at `contracts/cohold` as the only independently authoritative contract source. The repository SHALL build that crate to Wasm with `stellar contract build` and SHALL NOT treat an embedded TypeScript string as an editable second implementation.

#### Scenario: Contract source is extracted
- **WHEN** a developer opens the Cohold contract source
- **THEN** the implementation SHALL live under `contracts/cohold/src`
- **AND** any Contract Inspector display SHALL be generated from that Rust source rather than a separately maintained implementation

#### Scenario: Contract builds to Wasm
- **WHEN** a developer runs the documented contract build command
- **THEN** the crate SHALL produce a Wasm artifact
- **AND** `cargo test` for the crate SHALL have passed before that Wasm is treated as deployable

### Requirement: Canonical treasury interface
The contract SHALL expose initialize, contribute, create_proposal, approve, execute, get_config, get_members, is_member, get_balance, get_proposal, get_proposal_count, has_approved, and get_contribution_total. It SHALL NOT expose withdraw, change_threshold, add_member, remove_member, create_treasury, or upgrade_governance.

#### Scenario: Frontend reads members and proposal count
- **WHEN** a client calls `get_members` and `get_proposal_count` on an initialized instance
- **THEN** the contract SHALL return the stored member list and the current proposal counter
- **AND** the client SHALL NOT need to peek at raw ledger keys for those values

#### Scenario: Product interface omits governance mutation
- **WHEN** a caller searches the contract interface for membership or threshold mutation
- **THEN** no such method SHALL exist on the MVP contract

### Requirement: One instance is one treasury
Each deployed Cohold contract instance SHALL store exactly one treasury configuration and one internal balance. The instance SHALL NOT contain, index, or spend another instance's assets.

#### Scenario: Instance stores a single treasury
- **WHEN** `initialize` succeeds
- **THEN** the instance SHALL persist one `TreasuryConfig`, one member set, one threshold, one token address, one proposal counter, and one internal balance
- **AND** later calls SHALL operate only on that instance's storage

### Requirement: Initialization rules
`initialize` SHALL require creator authorization, execute only once, require a non-empty unique member list that includes the creator, require `0 < threshold <= member_count`, store the token SAC address, persist immutable membership and threshold, and initialize balance and proposal count to zero.

#### Scenario: Valid initialize
- **WHEN** the creator authorizes initialize with unique members including the creator, a valid threshold, and a token address
- **THEN** the contract SHALL persist that configuration
- **AND** `get_balance` SHALL return `0`
- **AND** `get_proposal_count` SHALL return `0`

#### Scenario: Initialize twice is rejected
- **WHEN** initialize is invoked on an already-initialized instance
- **THEN** the contract SHALL reject the call with `AlreadyInitialized`
- **AND** stored configuration SHALL remain unchanged

#### Scenario: Invalid membership or threshold is rejected
- **WHEN** members are empty, members contain duplicates, the creator is not a member, threshold is `0`, or threshold exceeds member count
- **THEN** the contract SHALL reject initialize
- **AND** SHALL NOT persist a partial configuration

### Requirement: Contribution rules
`contribute` SHALL require the member's authorization, reject non-members and non-positive amounts, transfer the token from the member to the contract, and only then increase internal balance and the member's contribution total. A failed token transfer SHALL leave Cohold storage unchanged.

#### Scenario: Member contributes a positive amount
- **WHEN** a member authorizes `contribute` with amount `> 0` and the token transfer succeeds
- **THEN** the contract's internal balance SHALL increase by exactly that amount
- **AND** `get_contribution_total` for that member SHALL increase by exactly that amount

#### Scenario: Non-member or zero contribution is rejected
- **WHEN** a non-member contributes, or a member contributes `0` or a negative amount
- **THEN** the contract SHALL reject the call
- **AND** internal balance SHALL remain unchanged

#### Scenario: Failed token transfer leaves state unchanged
- **WHEN** the underlying SAC transfer fails
- **THEN** the invocation SHALL fail
- **AND** internal balance and contribution totals SHALL remain unchanged

### Requirement: Proposal creation records Approval #1
`create_proposal` SHALL require proposer authorization and membership, reject non-positive amounts, store amount and recipient immutably, assign a unique proposal ID, set status `Pending` (or `Approved` when threshold is `1`), record the proposer as approved, and initialize `approval_count` to `1`.

#### Scenario: Member creates a proposal
- **WHEN** a member authorizes `create_proposal` with amount `> 0` and a valid recipient
- **THEN** the stored proposal SHALL have that exact amount and recipient
- **AND** `has_approved(id, proposer)` SHALL be true
- **AND** `approval_count` SHALL be `1`

#### Scenario: Threshold of one is immediately approved
- **WHEN** a member creates a proposal on a treasury whose threshold is `1`
- **THEN** the proposal status SHALL be `Approved`

#### Scenario: Non-member or zero-amount creation is rejected
- **WHEN** a non-member creates a proposal, or a member creates a proposal with amount `<= 0`
- **THEN** the contract SHALL reject the call
- **AND** `get_proposal_count` SHALL remain unchanged

### Requirement: Approval rules
`approve` SHALL require approver authorization and membership, require the proposal to exist and be `Pending`, reject a second approval from the same member, increment `approval_count` exactly once, and transition the proposal to `Approved` when `approval_count >= threshold`.

#### Scenario: Member approval increases the count once
- **WHEN** a member who has not yet approved a `Pending` proposal authorizes `approve`
- **THEN** `approval_count` SHALL increase by exactly one
- **AND** `has_approved` for that member SHALL be true

#### Scenario: Duplicate or outsider approval is rejected
- **WHEN** the same member approves again, or a non-member approves
- **THEN** the contract SHALL reject with `AlreadyApproved` or `NotMember` respectively
- **AND** `approval_count` SHALL remain unchanged

#### Scenario: Exact threshold transitions to Approved
- **WHEN** an approval causes `approval_count` to become greater than or equal to threshold
- **THEN** the proposal status SHALL become `Approved`

### Requirement: Execution rules
`execute` SHALL require the proposal to exist and have status `Approved`, reject `Pending` and `Executed` proposals, require internal balance `>=` the immutable amount, transfer exactly that amount to the immutable recipient, decrement internal balance once, and mark the proposal `Executed`. After approval, any authorized caller MAY submit execute; the caller SHALL NOT be able to change amount or recipient. The contract SHALL NOT add a member-only execution restriction.

#### Scenario: Approved execution transfers the exact amount
- **WHEN** an `Approved` proposal is executed and internal balance is sufficient
- **THEN** the recipient SHALL receive exactly `proposal.amount`
- **AND** internal balance SHALL decrease by exactly `proposal.amount`
- **AND** status SHALL become `Executed`

#### Scenario: Under-threshold or already-executed execute is rejected
- **WHEN** execute is invoked on a `Pending` proposal or an `Executed` proposal
- **THEN** the contract SHALL reject with `ThresholdNotReached` or `AlreadyExecuted`
- **AND** balances SHALL remain unchanged

#### Scenario: Insufficient balance leaves the proposal unexecuted
- **WHEN** execute is invoked on an `Approved` proposal whose amount exceeds internal balance
- **THEN** the contract SHALL reject with `InsufficientBalance`
- **AND** the proposal SHALL remain `Approved` and unexecuted

#### Scenario: Permissionless caller executes an approved proposal
- **WHEN** a non-member fee-payer submits execute for an `Approved` proposal with sufficient balance
- **THEN** the transfer SHALL succeed
- **AND** amount and recipient SHALL still be the stored proposal values

### Requirement: Creator has no extra spending power
The creator SHALL have the same contribute, propose, approve, and execute powers as any other member. The contract SHALL NOT provide a creator bypass around threshold, membership, or execution rules.

#### Scenario: Creator cannot execute under threshold
- **WHEN** the creator attempts to execute a proposal that is still `Pending`
- **THEN** the contract SHALL reject the call
- **AND** no funds SHALL leave the treasury

### Requirement: Local contract test gate
The crate SHALL include Soroban local tests covering initialization, authorization, membership, contributions, auto-approval, duplicate approval, threshold transition, under-threshold execute, exact transfer, insufficient balance, double execute, creator non-bypass, recipient-need-not-be-member, permissionless execute, and conservation of accounted balance. Tests SHALL use the local Soroban environment and a test token/SAC, not Testnet.

#### Scenario: Required contract tests pass locally
- **WHEN** a developer runs `cargo test` in the contract workspace
- **THEN** every required scenario above SHALL pass
- **AND** no test SHALL require a live Testnet RPC
