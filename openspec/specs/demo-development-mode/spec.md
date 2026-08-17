# demo-development-mode Specification

## Purpose
TBD - created by archiving change nextjs-mvp-frontend-foundation. Update Purpose after archive.
## Requirements
### Requirement: Explicit demo mode boundary
The application SHALL expose demo mode as an explicit configuration and visible UI state. Fixture data, persona switching, synthetic transaction hashes, reset actions, and mock persistence SHALL be available only through the demo adapter and SHALL not be used as wallet-mode authorization or confirmation.

#### Scenario: Developer starts the app in demo mode
- **WHEN** the configured mode is `demo`
- **THEN** the application SHALL load deterministic fixture data and may expose persona switching/reset controls
- **AND** the shell SHALL visibly identify the environment as demo/Testnet simulation

#### Scenario: User starts the app in wallet mode
- **WHEN** the configured mode is `wallet`
- **THEN** fixture personas and synthetic transaction success paths SHALL be unavailable
- **AND** state-changing actions SHALL require a connected wallet and the Stellar transaction gateway

### Requirement: Demo reset is isolated and deterministic
A demo reset operation SHALL affect only fixture state, restore the documented demo dataset, and clearly communicate that it does not reset or alter on-chain Testnet state.

#### Scenario: User resets demo data
- **WHEN** a user invokes the reset action while demo mode is active
- **THEN** the fixture adapter SHALL restore the canonical treasury/proposal/activity scenario
- **AND** the UI SHALL state that no wallet transaction or Testnet balance changed

#### Scenario: User attempts demo reset in wallet mode
- **WHEN** a reset request is made while wallet mode is active
- **THEN** the application SHALL reject or hide the operation
- **AND** SHALL not mutate database rows or contract state

### Requirement: Production-like mutation paths are guarded
Any remaining database-backed mutation route SHALL be explicitly scoped to demo mode or disabled in wallet mode. It SHALL reject or ignore caller-supplied identity and signature fields as authorization evidence, and SHALL not be described as Soroban execution.

#### Scenario: Client submits an altered actor to a demo route
- **WHEN** a demo mutation receives an actor field that is not the active fixture persona
- **THEN** the route SHALL reject the request or resolve the actor from server-side demo context
- **AND** SHALL not record the altered actor as an authorized wallet action

#### Scenario: Wallet mode receives a database mutation request
- **WHEN** a client posts to a demo/database mutation endpoint while wallet mode is active
- **THEN** the endpoint SHALL return a clear mode error
- **AND** SHALL direct the caller to the wallet transaction flow

### Requirement: Port-aware development command
The project SHALL document and support starting `next dev` on port `3001` by default for this workspace, with a deterministic fallback to the next available port when occupied. The selected port SHALL be printed in the startup output.

#### Scenario: Port 3001 is free
- **WHEN** a developer starts the documented development command and port `3001` is available
- **THEN** the app SHALL bind to `http://localhost:3001`
- **AND** the startup output SHALL identify that port

#### Scenario: Port 3001 is occupied
- **WHEN** a developer starts the documented development command and port `3001` is unavailable
- **THEN** the command SHALL select the next available port such as `3002`
- **AND** SHALL print the selected URL without killing or hijacking the existing process

### Requirement: Developer verification loop
The repository SHALL provide a documented verification loop that covers lint, typecheck, production build, demo smoke checks, and wallet/Testnet prerequisites. Generated framework files produced by validation SHALL be identified separately from intentional source changes.

#### Scenario: Developer validates a demo UI change
- **WHEN** a developer runs the documented local verification loop
- **THEN** lint, typecheck, build, and a demo route smoke check SHALL produce independently identifiable results
- **AND** the loop SHALL not require a live wallet or deployed contract

#### Scenario: Developer prepares a Testnet demo
- **WHEN** a developer selects wallet mode
- **THEN** the checklist SHALL require configured contract/token IDs, reachable RPC, Freighter on Testnet, funded accounts, and a known contract interface
- **AND** SHALL fail before signing if required configuration is absent
