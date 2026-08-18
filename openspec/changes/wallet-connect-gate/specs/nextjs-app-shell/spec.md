## MODIFIED Requirements

### Requirement: Server and client boundaries
Page-level data loading and metadata SHALL remain server-compatible where possible, while wallet access, transaction signing, dialogs, and other browser-only interactions SHALL be isolated to client modules below the route boundary. The public landing page SHALL NOT require `window`, Freighter, or a connected account during server rendering; its connect control is a client island that activates only after hydration.

#### Scenario: Public landing page loads without wallet APIs
- **WHEN** a browser or crawler requests `/` without a wallet extension
- **THEN** the page SHALL render its product explanation and primary actions
- **AND** SHALL NOT require `window`, Freighter, or a connected account during server rendering

#### Scenario: Connect control renders as an interactive island on the landing
- **WHEN** the landing page mounts a connect control
- **THEN** the control SHALL live in a client component below the server-rendered page
- **AND** SHALL read wallet state from the shared wallet provider without triggering Freighter calls during server rendering

#### Scenario: Wallet action is rendered in an interactive island
- **WHEN** a user opens a state-changing form
- **THEN** the form SHALL load the wallet/transaction client only at the interactive boundary
- **AND** server-rendered page data SHALL not contain private keys, signed XDR, or wallet secrets

## ADDED Requirements

### Requirement: Shell-level authentication gating
The shared shell SHALL gate dashboard routes behind the authentication predicate defined by the wallet-authentication-gate capability; the gate SHALL render in place (no redirect to a connect route) and SHALL reuse the existing connect and setup-state presentation.

#### Scenario: Unauthenticated dashboard route
- **WHEN** a visitor opens a dashboard route without an established identity
- **THEN** the shell SHALL render the connect screen in place of the page content
- **AND** the response SHALL remain a normal page render (no redirect loop, no separate connect URL required)

#### Scenario: Authenticated dashboard route
- **WHEN** a visitor opens a dashboard route with an established identity
- **THEN** the shell SHALL render the requested page
- **AND** the wallet/network context SHALL be preserved across route changes without remounting the provider tree