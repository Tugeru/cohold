## ADDED Requirements

### Requirement: Demo mutation guard is explicitly named
Fixture and database mutations SHALL be gated by a function whose name states demo-only permission, such as `isDemoMutationAllowed()`. That function SHALL return true only when configured mode is `demo`. Wallet mode SHALL continue to permit real Soroban transactions through the wallet flows and SHALL NOT treat the guard as a switch that enables database writes.

#### Scenario: Demo mode still permits fixture mutations
- **WHEN** configured mode is `demo`
- **THEN** `isDemoMutationAllowed()` SHALL return true
- **AND** fixture/database demo adapters MAY mutate local state

#### Scenario: Wallet mode still forbids fixture mutations
- **WHEN** configured mode is `wallet`
- **THEN** `isDemoMutationAllowed()` SHALL return false
- **AND** contribute, propose, approve, and execute SHALL still be allowed through the Stellar transaction gateway

#### Scenario: Call sites no longer use the old name
- **WHEN** the codebase is searched for `isStateChangingAllowed`
- **THEN** no production call site SHALL remain
- **AND** tests SHALL assert the renamed demo-only behavior, including that valid wallet identifiers do not enable fixture writes

### Requirement: Testnet bootstrap is documented without mixing fixtures
The developer runbook SHALL document `testnet:bootstrap` (or the equivalent script), required CLI identities, Freighter mapping, and the `NEXT_PUBLIC_*` values copied from bootstrap output. Following those steps SHALL NOT copy demo fixture treasuries, personas, or synthetic hashes into wallet mode.

#### Scenario: Operator follows the Testnet checklist
- **WHEN** a developer switches from demo mode to wallet mode using the runbook
- **THEN** the checklist SHALL require bootstrap or an existing `deployments/testnet.json`, configured contract/token IDs, reachable RPC, and Freighter on Testnet
- **AND** SHALL warn that demo fixtures are not Testnet state

## MODIFIED Requirements

### Requirement: Developer verification loop
The repository SHALL provide a documented verification loop that covers lint, typecheck, frontend tests, production build, demo smoke checks, `cargo test`, `stellar contract build`, binding compatibility, and wallet/Testnet prerequisites. Generated framework files produced by validation SHALL be identified separately from intentional source changes. Live Testnet acceptance SHALL be documented as a manual or protected workflow, not a required public PR check.

#### Scenario: Developer validates a demo UI change
- **WHEN** a developer runs the documented local verification loop
- **THEN** lint, typecheck, frontend tests, build, and a demo route smoke check SHALL produce independently identifiable results
- **AND** the loop SHALL not require a live wallet or deployed contract

#### Scenario: Developer validates a contract change
- **WHEN** a developer changes `contracts/cohold`
- **THEN** the verification loop SHALL require `cargo test` and `stellar contract build` to pass
- **AND** the binding-compatibility check SHALL fail if generated types no longer match the adapter

#### Scenario: Developer prepares a Testnet demo
- **WHEN** a developer selects wallet mode
- **THEN** the checklist SHALL require configured contract/token IDs from the deployment manifest, reachable RPC, Freighter on Testnet, funded accounts, and generated bindings that match the deployed interface
- **AND** SHALL fail before signing if required configuration is absent
