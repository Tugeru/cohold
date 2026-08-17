## ADDED Requirements

### Requirement: Route-level MVP information architecture
The application SHALL expose the MVP experience through App Router routes for the public landing page, overview, treasuries, treasury detail, proposals, proposal detail, activity, and wallet/settings contexts. Navigation SHALL use URLs and links as the source of truth rather than a root-only local view enum.

#### Scenario: User opens a treasury detail link directly
- **WHEN** a user visits `/treasuries/<treasury-id>` directly or refreshes that URL
- **THEN** the application SHALL resolve the treasury page independently of prior client navigation state
- **AND** SHALL show a not-found state when the treasury does not exist

#### Scenario: User navigates between MVP pages
- **WHEN** a user selects a primary navigation item
- **THEN** the browser URL SHALL update to the corresponding route
- **AND** the shared shell SHALL preserve wallet/network context without remounting unrelated page data unnecessarily

### Requirement: Server and client boundaries
Page-level data loading and metadata SHALL remain server-compatible where possible, while wallet access, transaction signing, dialogs, and other browser-only interactions SHALL be isolated to client modules below the route boundary.

#### Scenario: Public landing page loads without wallet APIs
- **WHEN** a browser or crawler requests `/` without a wallet extension
- **THEN** the page SHALL render its product explanation and primary actions
- **AND** SHALL NOT require `window`, Freighter, or a connected account during server rendering

#### Scenario: Wallet action is rendered in an interactive island
- **WHEN** a user opens a state-changing form
- **THEN** the form SHALL load the wallet/transaction client only at the interactive boundary
- **AND** server-rendered page data SHALL not contain private keys, signed XDR, or wallet secrets

### Requirement: First-class page states
Each data-backed MVP route SHALL define loading, recoverable error, and not-found behavior. State-changing controls SHALL expose idle, preparing, awaiting signature, submitted, confirming, confirmed, cancelled, and failed states where applicable.

#### Scenario: Treasury data is loading
- **WHEN** the treasury route is waiting for its data source
- **THEN** it SHALL render a page-appropriate skeleton
- **AND** SHALL preserve the page structure without a generic blocking spinner

#### Scenario: A read fails
- **WHEN** a treasury or proposal read fails
- **THEN** the page SHALL explain what could not be loaded in product language
- **AND** SHALL provide a retry action without claiming that financial state changed

### Requirement: Responsive and accessible financial UI
Core workflows SHALL remain usable on mobile without required horizontal scrolling, use semantic labels and keyboard focus, and communicate status with text or structure in addition to color.

#### Scenario: User reviews a proposal on a narrow viewport
- **WHEN** the proposal detail page is rendered at a mobile viewport
- **THEN** amount, asset, recipient, approval progress, current-user approval state, and action state SHALL remain visible without horizontal scrolling
- **AND** the primary action SHALL meet the touch-target and focus requirements defined by the UI/UX specification

#### Scenario: User operates a confirmation dialog by keyboard
- **WHEN** a user opens a contribution or payment confirmation dialog and uses keyboard navigation
- **THEN** focus SHALL move into the dialog, remain trapped while open, and return to the invoking control after close
- **AND** the exact treasury, amount, asset, recipient, and approval state SHALL be announced or available as labeled content

### Requirement: Governed-money visual language
The MVP visual system SHALL present Cohold as a calm shared-finance product, visibly identify Testnet/demo context, and make approval requirements and current progress prominent without relying on crypto-specific decorative language.

#### Scenario: User views a treasury or proposal
- **WHEN** a treasury balance or proposal action is displayed
- **THEN** the interface SHALL show the asset and relevant Testnet/demo context near the financial value
- **AND** SHALL expose the approval rule and progress as readable content rather than an icon-only or color-only signal

#### Scenario: User enters a blocked state
- **WHEN** a proposal lacks approvals, lacks balance, or the wallet is on the wrong network
- **THEN** the UI SHALL explain the blocking condition and the next useful action
- **AND** SHALL not present an inactive or unsafe control as if it were executable
