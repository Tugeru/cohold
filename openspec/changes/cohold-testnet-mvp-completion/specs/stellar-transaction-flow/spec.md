## ADDED Requirements

### Requirement: Fail-closed live wallet diagnostics
Wallet mode SHALL treat static `C...` identifier checks as insufficient. When wallet resources load, the application SHALL verify Testnet-only configuration, reachable RPC, a Cohold-shaped `get_config` on the primary contract, that the configured token ID matches the on-chain config token, and that members, threshold, and balance are readable. Any failure SHALL disable financial actions and SHALL NOT fall back to fixture state.

#### Scenario: Configured treasury responds with the expected shape
- **WHEN** wallet mode loads and the primary contract returns config, members, threshold, token, and balance
- **AND** the on-chain token equals `NEXT_PUBLIC_STELLAR_TOKEN_ID`
- **THEN** the gateway SHALL enable wallet-mode reads and subsequent transaction preparation

#### Scenario: Wrong token or unreachable RPC fails closed
- **WHEN** RPC is unreachable, `get_config` does not match the Cohold shape, or the on-chain token differs from the configured token ID
- **THEN** the UI SHALL show wallet setup incomplete or configured Testnet treasury unavailable
- **AND** contribute, propose, approve, and execute SHALL remain disabled
- **AND** demo fixture treasuries SHALL NOT be substituted

### Requirement: Generated bindings behind the transaction seam
State-changing wallet operations SHALL be built with the generated `packages/cohold-contract` client (or an adapter that wraps it). UI components, context providers, and route handlers SHALL NOT import the generated client. Token address, treasury contract ID, and actor SHALL come from configuration and the connected wallet, never from a form-supplied contract or signature field.

#### Scenario: Contribute uses generated contribute method
- **WHEN** a member prepares a contribution in wallet mode
- **THEN** the executor SHALL invoke the generated `contribute` binding against the configured treasury contract
- **AND** the signed transaction SHALL authorize the connected wallet as the member

#### Scenario: Components do not import generated bindings
- **WHEN** a treasury or proposal page prepares a wallet action
- **THEN** it SHALL call `contribute-flow` or `proposal-flow`
- **AND** it SHALL NOT import `packages/cohold-contract`

### Requirement: End-to-end contribute lifecycle
Wallet-mode contribution SHALL validate amount as integer base units, require a connected Testnet wallet, simulate `contribute`, distinguish rejected signatures from submitted/failed transactions, and re-read treasury balance only after RPC reports success.

#### Scenario: Confirmed contribution updates balance from chain
- **WHEN** a member's contribute transaction reports `SUCCESS`
- **THEN** the application SHALL re-read `get_balance`
- **AND** SHALL display the new balance only from that read

#### Scenario: Rejected contribution signature changes nothing
- **WHEN** Freighter rejects the contribute signature
- **THEN** the gateway SHALL return cancelled
- **AND** displayed treasury balance SHALL remain the last authoritative read

### Requirement: End-to-end proposal lifecycle
Wallet-mode create, approve, and execute SHALL follow simulate → sign → submit → confirm → re-read. After a confirmed create, the UI SHALL show the proposer as approved and `approval_count = 1`. Before execute, the confirmation surface SHALL show treasury, asset, exact amount, exact recipient, threshold, current approvals, and current treasury balance.

#### Scenario: Confirmed create shows auto-approval
- **WHEN** create_proposal confirms on Testnet
- **THEN** the re-read proposal SHALL report the connected wallet as proposer
- **AND** current-user approval SHALL be approved
- **AND** approval progress SHALL start at `1 / threshold`

#### Scenario: Execute review shows exact payment terms
- **WHEN** a user opens execute confirmation for an approved proposal
- **THEN** the surface SHALL show treasury, asset, exact amount, exact recipient, approval progress, and current treasury balance
- **AND** signing SHALL NOT start until the user confirms that review

#### Scenario: Confirmed execute refreshes proposal and treasury
- **WHEN** execute reports `SUCCESS`
- **THEN** the application SHALL re-read the proposal and treasury balance
- **AND** SHALL NOT mark the proposal executed from the signature or hash alone
