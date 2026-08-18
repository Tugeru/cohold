## ADDED Requirements

### Requirement: Reproducible Testnet bootstrap
The repository SHALL provide a single documented bootstrap command that verifies the Stellar CLI and Testnet, builds the Cohold Wasm, records Wasm provenance, resolves the native XLM SAC, deploys and initializes two contract instances, generates TypeScript bindings, writes `deployments/testnet.json`, prints required `NEXT_PUBLIC_*` values, and runs read-only sanity checks. The command SHALL NOT write secret keys into frontend configuration or the committed manifest.

#### Scenario: Fresh bootstrap produces two initialized treasuries
- **WHEN** an operator runs the documented bootstrap command against Stellar Testnet
- **THEN** two Cohold contract IDs SHALL be deployed from the same Wasm
- **AND** both SHALL respond to `get_config` with the expected members, threshold, and token
- **AND** both balances SHALL be readable

#### Scenario: Bootstrap does not leak secrets
- **WHEN** bootstrap writes `deployments/testnet.json` and prints env guidance
- **THEN** the written files and printed `NEXT_PUBLIC_*` values SHALL contain only public contract/token IDs and network metadata
- **AND** SHALL NOT contain secret keys, seed phrases, or Freighter secrets

### Requirement: Native XLM SAC is the live token
Wallet-mode Testnet treasuries SHALL use the existing native Testnet XLM Stellar Asset Contract. Bootstrap SHALL resolve that contract ID with the official asset-id command and persist it as `tokenContractId`.

#### Scenario: Token contract is the native SAC
- **WHEN** bootstrap resolves the live token
- **THEN** the stored token contract ID SHALL be the Testnet native asset contract
- **AND** both treasury instances SHALL be initialized with that token address

### Requirement: Two independently initialized treasuries
Bootstrap SHALL deploy a primary treasury (IT Society Event Fund, four members, threshold 3) and a secondary treasury (Capstone Project Fund) from the same Wasm. Each instance SHALL have its own members, threshold, and balance. Wallet-mode Create Treasury SHALL remain unavailable.

#### Scenario: Primary treasury matches the demo roster
- **WHEN** Contract A is initialized
- **THEN** `get_config` SHALL report threshold `3` and member count `4`
- **AND** `get_members` SHALL return the configured A–D addresses

#### Scenario: Secondary treasury is a separate instance
- **WHEN** Contract B is initialized from the same Wasm
- **THEN** its contract ID SHALL differ from Contract A
- **AND** its internal balance SHALL be independent of Contract A

#### Scenario: Wallet mode has no create-treasury path
- **WHEN** the application is in wallet mode
- **THEN** it SHALL NOT deploy or initialize a new Cohold contract
- **AND** it SHALL only open environment-configured contract IDs

### Requirement: Secret-free deployment manifest
The repository SHALL commit `deployments/testnet.json` recording network, RPC URL, asset, token contract ID, git commit, Wasm SHA-256, deploy timestamp, and each treasury's alias, contract ID, name, threshold, and member count. The file SHALL NOT contain secrets.

#### Scenario: Manifest links source to deployed Wasm
- **WHEN** an operator inspects `deployments/testnet.json` after bootstrap
- **THEN** the file SHALL include git commit SHA, Wasm SHA-256, token contract ID, and both treasury contract IDs
- **AND** those values SHALL be sufficient to confirm the deployed Wasm matches the reviewed source

### Requirement: Generated TypeScript bindings package
Bootstrap SHALL generate a typed TypeScript package at `packages/cohold-contract` from the built/deployed contract interface. Application UI, context, and route handlers SHALL NOT import that package. Only the contract adapter and wallet transaction flows MAY import it.

#### Scenario: Bindings match the deployed interface
- **WHEN** TypeScript bindings are generated after the contract interface is frozen
- **THEN** `packages/cohold-contract` SHALL expose typed methods for every canonical contract entrypoint
- **AND** the frontend adapter SHALL compile against those methods

#### Scenario: Generated client does not leak into UI
- **WHEN** a React component or App Router page needs treasury or proposal state
- **THEN** it SHALL consume adapter/flow types
- **AND** it SHALL NOT import `packages/cohold-contract` directly

### Requirement: Live-test secrets stay off the public client
Automated Testnet acceptance credentials (`COHOLD_TESTNET_SECRET_*` and related contract IDs) SHALL live in ignored local env or CI secrets. They SHALL never use the `NEXT_PUBLIC_` prefix and SHALL never be committed.

#### Scenario: Frontend env cannot see test keypairs
- **WHEN** a developer inspects `.env.example` and committed config
- **THEN** live-test secret variable names SHALL be documented without values
- **AND** no `NEXT_PUBLIC_*` variable SHALL hold a secret key
