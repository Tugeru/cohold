## ADDED Requirements

### Requirement: One configured contract ID is one treasury
In wallet mode each configured contract ID SHALL map to exactly one treasury view. The read adapter SHALL NOT merge balances, members, proposals, or approvals across contract IDs. A missing or uninitialized contract SHALL fail that treasury's read rather than substituting another instance or fixture data.

#### Scenario: User opens the primary configured treasury
- **WHEN** wallet mode loads the primary `NEXT_PUBLIC_STELLAR_CONTRACT_ID`
- **THEN** the treasury view SHALL contain only that instance's members, threshold, token, balance, and proposals

#### Scenario: Secondary contract is isolated in the read model
- **WHEN** wallet mode lists both configured contract IDs
- **THEN** each treasury view SHALL report its own contract ID and internal balance
- **AND** a failed read of one instance SHALL NOT populate that view from the other instance

### Requirement: On-chain config and token verification at load
When loading a wallet-mode treasury, the read adapter SHALL call `get_config`, verify the result is a Cohold treasury shape, verify the on-chain token address equals the configured token ID, and read members, threshold, and balance through public contract methods. It SHALL NOT peek at raw `MemberList` or `ProposalCount` ledger keys once those getters exist.

#### Scenario: Load uses public getters
- **WHEN** the adapter loads a treasury after the contract exposes `get_members` and `get_proposal_count`
- **THEN** it SHALL call those generated methods
- **AND** SHALL NOT read `MemberList` or `ProposalCount` through raw ledger entries

#### Scenario: Token mismatch fails the treasury read
- **WHEN** `get_config` returns a token address that differs from `NEXT_PUBLIC_STELLAR_TOKEN_ID`
- **THEN** the adapter SHALL fail the load
- **AND** SHALL NOT present the mismatched treasury as a valid wallet-mode treasury

### Requirement: Wallet activity comes from the contract
Wallet-mode activity SHALL be derived from confirmed Soroban events and/or authoritative proposal and treasury reads. It SHALL NOT render demo fixture audit rows as Testnet activity. Confirmed operations SHALL expose a transaction hash as secondary verification evidence.

#### Scenario: Contribution appears as chain activity
- **WHEN** a contribution transaction confirms and recent events are available
- **THEN** activity SHALL show a contribution entry with the transaction hash
- **AND** SHALL NOT insert a fixture deposit row

#### Scenario: Wallet activity has no fixture fallback
- **WHEN** RPC event history is empty or unavailable in wallet mode
- **THEN** the page SHALL show an empty or limited recent-window state
- **AND** SHALL NOT substitute demo fixture activity
