## ADDED Requirements

### Requirement: Identity-first entry gate
The application SHALL require an established identity before rendering the dashboard shell: in wallet mode, a Freighter connection on Stellar Testnet with healthy wallet resources; in demo mode, an explicit persona selection. Unauthenticated visitors SHALL see a connect screen instead of the dashboard content, in both modes.

#### Scenario: Visitor arrives at the landing page in wallet mode
- **WHEN** a visitor opens `/` while the app is in wallet mode and no wallet is connected
- **THEN** the landing page SHALL render a primary "Connect Wallet" action
- **AND** connecting through Freighter on Testnet SHALL route the visitor to `/overview`

#### Scenario: Visitor arrives at the landing page in demo mode
- **WHEN** a visitor opens `/` while the app is in demo mode and no persona has been entered
- **THEN** the landing page SHALL render a persona connection control
- **AND** selecting a persona SHALL route the visitor to `/overview` as that persona

#### Scenario: Visitor deep-links or reloads an app route while unauthenticated
- **WHEN** a visitor opens any dashboard route (`/overview`, `/treasuries`, `/treasuries/<id>`, `/proposals`, `/proposals/<id>`, `/activity`, `/wallet`, `/settings`) without an established identity
- **THEN** the route SHALL render the connect screen instead of the dashboard
- **AND** after a successful connect the visitor SHALL land on `/overview` regardless of the originally requested route

### Requirement: Mode-aware authentication definition
The definition of "authenticated" SHALL differ by mode and SHALL be computed by a single testable predicate. Wallet mode requires Freighter connected, Testnet network passphrase, and healthy wallet resource diagnostics. Demo mode requires a persona entered for the current browser session.

#### Scenario: Wallet connected on the wrong network
- **WHEN** Freighter is connected but the network passphrase is not Stellar Testnet
- **THEN** the connect screen SHALL report the wrong network in plain language
- **AND** the visitor SHALL NOT reach the dashboard

#### Scenario: Freighter extension is not installed
- **WHEN** the visitor has no Freighter extension and wallet mode is active
- **THEN** the connect screen SHALL show that Freighter is required and how to install it
- **AND** the visitor SHALL NOT reach the dashboard

#### Scenario: Wallet resource diagnostics fail
- **WHEN** the connected wallet is on Testnet but contract/token/RPC diagnostics fail
- **THEN** the connect screen SHALL show the failing checks with a retry action
- **AND** the visitor SHALL NOT reach the dashboard

#### Scenario: Demo visitor reloads after entering
- **WHEN** a demo visitor has entered with a persona and reloads the dashboard
- **THEN** the visitor SHALL remain authenticated for that browser session
- **AND** SHALL NOT be forced back through the persona connection screen

### Requirement: Post-connect routing to the dashboard
After a successful connect — from the landing page or from the shell gate — the application SHALL route to `/overview` in both modes. Demo mode renders the persona dashboard; wallet mode renders the chain-driven wallet overview (configured treasury contracts and their proposals read from RPC, with on-chain actions reachable from the treasury and proposal routes). The originally requested path SHALL NOT be restored.

#### Scenario: Connecting from the shell gate after a deep link
- **WHEN** an unauthenticated visitor deep-links to `/treasuries/<id>` and connects from the gate
- **THEN** the application SHALL route to `/overview` rather than the deep-linked treasury

#### Scenario: Connected wallet user lands on the wallet dashboard
- **WHEN** a wallet-mode visitor connects successfully
- **THEN** the application SHALL route to `/overview`
- **AND** `/overview` SHALL render the live wallet overview: total balance across loaded treasuries, active treasury count, proposals needing the connected wallet's approval, and proposals ready to disburse, all assembled from the configured contracts via chain reads

#### Scenario: A wallet treasury read fails
- **WHEN** one configured contract cannot be read while others load
- **THEN** the overview SHALL keep the healthy treasuries visible and render a labeled failure tile for the unreadable one
- **AND** SHALL NOT fabricate balances, members, or proposals for the failed contract

### Requirement: Reuse of established wallet state
The gate SHALL derive authentication from existing wallet context state (`isFreighterConnected`, network passphrase, `walletDiagnostics`, mode) and SHALL NOT duplicate connection bookkeeping or introduce a parallel sign-in store. Authentication SHALL be established only by an explicit visitor action — clicking Connect (wallet mode) or picking a persona (demo mode); the provider SHALL NOT auto-restore a connection or session on mount, and routing SHALL NOT be triggered by mount-time state.

#### Scenario: Returning wallet visitor must connect explicitly
- **WHEN** a wallet-mode visitor with a previously granted Freighter account opens the app
- **THEN** the visitor SHALL start unauthenticated on the connect screen
- **AND** SHALL NOT reach the dashboard until they click Connect; the click re-establishes the address without a new Freighter permission prompt

#### Scenario: Demo visitor reloads after entering
- **WHEN** a demo visitor who entered with a persona reloads the app
- **THEN** the visitor SHALL start unauthenticated on the connect screen
- **AND** SHALL NOT reach the dashboard until they pick a persona again