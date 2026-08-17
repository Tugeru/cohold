## Purpose
The contract-authoritative-read-model capability defines normalized Soroban/RPC reads for authoritative treasury, proposal, balance, approval, and recent activity state.

## ADDED Requirements

### Requirement: Contract-authoritative treasury reads
In wallet mode, the application SHALL read treasury configuration, membership, threshold, token, internal balance, and status from the configured Soroban contract or a verified RPC-derived projection. Database rows or client state SHALL not override authoritative on-chain financial or governance values.

#### Scenario: User opens a treasury in wallet mode
- **WHEN** the treasury detail route loads with a configured contract identifier
- **THEN** the page SHALL request the treasury state through the contract/RPC read adapter
- **AND** SHALL display the on-chain member set, threshold, token, and internal balance

#### Scenario: Local metadata differs from chain state
- **WHEN** optional fixture or database metadata disagrees with an on-chain balance, member, threshold, proposal amount, recipient, approval, or status
- **THEN** the normalized view model SHALL use the chain value for the financial/governance field
- **AND** SHALL either omit or visibly mark the metadata as non-authoritative

### Requirement: Normalized treasury and proposal view models
The read adapter SHALL convert RPC/contract results into stable typed view models for pages and components. View models SHALL include enough information to render the UI/UX acceptance criteria, including asset, balance, members, threshold, proposal amount, recipient, proposer, approval progress, current-user approval status, and lifecycle status.

#### Scenario: Proposal detail is rendered
- **WHEN** the proposal read succeeds
- **THEN** the view model SHALL expose amount, asset, recipient, proposer, approval count, threshold, status, and the connected user's approval state
- **AND** components SHALL not parse raw ScVal, XDR, or provider-specific database shapes

#### Scenario: A member approval query is unavailable
- **WHEN** the adapter cannot determine whether the current wallet has approved
- **THEN** it SHALL return an explicit unknown state
- **AND** the UI SHALL not claim that the user approved or that approval is still available without evidence

### Requirement: Base-unit financial values
Authoritative monetary values SHALL be represented as validated integer base units at the adapter and domain seams. Human-readable decimal formatting SHALL occur only at the presentation boundary and SHALL use the token's configured decimal precision.

#### Scenario: User enters a contribution amount
- **WHEN** a user submits zero, negative, malformed, fractional-beyond-precision, or out-of-range input
- **THEN** validation SHALL reject the input before transaction construction
- **AND** SHALL show a field-level explanation

#### Scenario: Treasury balance is formatted
- **WHEN** a base-unit balance is rendered
- **THEN** the formatter SHALL preserve exact value semantics using configured decimals
- **AND** SHALL not use floating-point arithmetic for comparisons, approval checks, or execution eligibility

### Requirement: Atomic authoritative refresh
After a confirmed state-changing transaction, the application SHALL refresh the affected treasury/proposal read model from the authoritative source before presenting updated financial state as complete.

#### Scenario: Contribution is confirmed
- **WHEN** the contribution transaction reports `SUCCESS`
- **THEN** the application SHALL re-read the treasury balance and contribution/activity state
- **AND** SHALL render the confirmed state only after the read succeeds or explicitly show that refresh is pending

#### Scenario: Refresh fails after confirmation
- **WHEN** a transaction is confirmed but the follow-up read fails
- **THEN** the UI SHALL show that the transaction was confirmed while the displayed state is stale
- **AND** SHALL offer a retry without inventing a new balance or proposal status

### Requirement: Activity semantics are explicit
The application SHALL label activity data according to its source and retention. Contract events and verified transactions SHALL be distinguishable from demo fixture activity, and recent RPC retention limitations SHALL not be presented as complete audit history.

#### Scenario: User views activity in demo mode
- **WHEN** activity is backed by fixture data
- **THEN** the page SHALL visibly identify it as demo activity
- **AND** SHALL not imply that the entries are confirmed Testnet transactions

#### Scenario: User views activity in wallet mode
- **WHEN** recent contract events or transactions are available from RPC
- **THEN** the page SHALL show their confirmation/source context
- **AND** SHALL communicate when the displayed history is limited to the available recent window
