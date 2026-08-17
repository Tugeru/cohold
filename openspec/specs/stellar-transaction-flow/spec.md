# stellar-transaction-flow Specification

## Purpose
The stellar-transaction-flow capability defines the safe Freighter/Testnet transaction lifecycle: centralized configuration, wallet-derived identity, pre-sign simulation, submission and confirmation, authoritative refresh, duplicate-submit prevention, and human-readable contract errors.
## Requirements
### Requirement: Centralized Stellar network configuration
The application SHALL centralize the selected network, RPC URL, Horizon compatibility URL, network passphrase, contract ID, token/SAC ID, and demo mode. Wallet actions SHALL validate that the wallet network matches the configured Testnet network before signing.

#### Scenario: Wallet is connected to the configured Testnet
- **WHEN** Freighter reports a connected address and the configured Testnet passphrase
- **THEN** the transaction gateway SHALL permit a transaction preview or signing request
- **AND** SHALL use the configured contract and token identifiers rather than values supplied by a page form

#### Scenario: Wallet is on the wrong network
- **WHEN** Freighter reports a network other than configured Stellar Testnet
- **THEN** the gateway SHALL block state-changing actions before signing
- **AND** the UI SHALL tell the user to switch to Stellar Testnet

### Requirement: Safe wallet identity
Wallet mode SHALL derive the acting address from the connected wallet adapter. No request body field, persona label, client-provided signature string, or executor default SHALL be accepted as proof of authorization.

#### Scenario: User approves a proposal
- **WHEN** the connected wallet signs an approval transaction
- **THEN** the gateway SHALL associate the action with the address returned by the wallet adapter
- **AND** SHALL submit a transaction whose contract authorization is evaluated by Soroban

#### Scenario: Caller alters an actor field
- **WHEN** a client changes an `approverAddress`, `proposerAddress`, or `executorAddress` field without changing the connected wallet
- **THEN** the wallet-mode operation SHALL ignore or reject the altered field
- **AND** SHALL not record the altered value as the actor of a successful financial action

### Requirement: Simulate before signing
Every state-changing Soroban operation SHALL be built with the typed contract client or equivalent validated builder and simulated before the wallet is asked to sign. Simulation failures SHALL prevent signing and map to actionable product errors.

#### Scenario: Proposal execution is under-approved
- **WHEN** execution simulation reports that the threshold has not been reached
- **THEN** the gateway SHALL return a blocked result describing the approvals still required
- **AND** SHALL not open a wallet signature request

#### Scenario: Simulation succeeds
- **WHEN** simulation succeeds for a valid operation
- **THEN** the gateway SHALL expose the exact operation context for review
- **AND** SHALL proceed to signing only after the user invokes the explicit action

### Requirement: Confirmed transaction lifecycle
The gateway SHALL distinguish preparation, awaiting signature, submitted, confirming, confirmed, cancelled, and failed states. A financial action SHALL not be reported as successful until RPC confirms the transaction as successful, after which authoritative state SHALL be re-read.

#### Scenario: User rejects a signature
- **WHEN** the wallet rejects or cancels a signing request
- **THEN** the gateway SHALL return a cancelled result
- **AND** SHALL not show the action as submitted or successful
- **AND** SHALL not mutate local authoritative state

#### Scenario: Transaction is submitted and confirmed
- **WHEN** RPC accepts a signed transaction and later reports `SUCCESS`
- **THEN** the gateway SHALL expose the transaction hash and confirmed result
- **AND** SHALL trigger a fresh read of the affected treasury/proposal state

#### Scenario: Transaction fails after submission
- **WHEN** RPC reports a failed transaction or confirmation timeout
- **THEN** the gateway SHALL show a failed or retryable state with the hash when available
- **AND** SHALL not optimistically mark a proposal executed or a balance changed

### Requirement: Safe submission controls
State-changing controls SHALL prevent duplicate submissions while an operation is in flight and SHALL expose an explicit review of exact amount, asset, treasury, recipient, and approval state before signing.

#### Scenario: User double-clicks Execute Payment
- **WHEN** an execution operation is preparing, awaiting signature, submitted, or confirming
- **THEN** subsequent execution attempts SHALL be disabled or coalesced
- **AND** only one transaction request SHALL be sent for that user action

#### Scenario: User reviews a payment
- **WHEN** an approved proposal is ready for execution
- **THEN** the confirmation surface SHALL show the exact amount, asset, source treasury, recipient, and threshold progress
- **AND** SHALL require an explicit confirmation before wallet signing

### Requirement: Human-readable contract errors
The transaction gateway SHALL map common wallet, network, RPC, and contract errors such as `NotMember`, `AlreadyApproved`, `ThresholdNotReached`, `InsufficientBalance`, `AlreadyExecuted`, invalid amount, and invalid recipient into stable user-facing messages without exposing raw host errors as the primary message.

#### Scenario: Duplicate approval is rejected
- **WHEN** the contract rejects an approval because the member already approved
- **THEN** the UI SHALL state that the user has already approved the proposal
- **AND** SHALL leave the approval count and proposal status unchanged locally until a fresh read confirms otherwise

#### Scenario: Insufficient balance blocks execution
- **WHEN** execution fails because the treasury's internal balance is insufficient
- **THEN** the UI SHALL show required versus available amount when known
- **AND** SHALL state that treasury funds were not changed
