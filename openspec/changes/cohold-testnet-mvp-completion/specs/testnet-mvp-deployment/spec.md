# testnet-mvp-deployment Specification

## Purpose

The testnet-mvp-deployment capability defines how Cohold's contract reaches
live Stellar Testnet acceptance: one deployed contract instance is exactly
one treasury, treasuries are initialized with immutable members and
thresholds from the reviewed Wasm, the deployment facts are recorded in a
secret-free manifest, and every live suite guards against drift between the
manifest and the chain.

## ADDED Requirements

### Requirement: One instance is one treasury

The MVP SHALL deploy one independent contract instance per treasury, each
initialized with its own fixed member set and approval threshold. A single
instance SHALL NOT back multiple treasuries, and treasury balances SHALL NOT
be shared or transferable between instances.

#### Scenario: Two treasuries are deployed from the same Wasm

- **WHEN** the bootstrap deploys treasury A and treasury B from the reviewed
  Cohold Wasm
- **THEN** each treasury SHALL be its own contract instance with its own
  contract id, members, threshold, and internal balance
- **AND** a spend in treasury A SHALL NOT change treasury B's balance,
  proposal count, or proposal state

### Requirement: Secret-free deployment manifest

The bootstrap SHALL record deployment facts in a committed, secret-free
manifest (`deployments/testnet.json`): network, RPC URL, asset, token
contract id, deployment git SHA, Wasm SHA-256, both treasury contract ids
with names/members/thresholds, and identity public keys. Wallet secrets
SHALL stay in the stellar CLI keyring and never enter the repository.

#### Scenario: A reviewer audits the deployment

- **WHEN** a reviewer opens `deployments/testnet.json`
- **THEN** they SHALL be able to map every treasury id, member address, and
  threshold to a deployed instance
- **AND** the manifest SHALL contain no secret key material

### Requirement: Live drift guards

Opt-in live suites SHALL assert the on-chain treasury configuration
(threshold, name, token address, member set) matches the manifest before
exercising any flow, and SHALL refuse to run with missing or malformed
secret keys or identical treasury ids.

#### Scenario: Manifest and chain disagree

- **WHEN** the live matrix starts against a treasury whose on-chain config
  differs from the manifest
- **THEN** the suite SHALL fail loudly before any scenario runs
- **AND** the runner SHALL refuse to start when required secrets are missing