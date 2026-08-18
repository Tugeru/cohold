## ADDED Requirements

### Requirement: Persona connect entry on the landing
In demo mode the landing page SHALL offer a persona connection control that establishes the active demo identity before the dashboard is accessible. Selecting a persona is the demo-mode equivalent of wallet connection and SHALL route the visitor to `/overview`.

#### Scenario: Visitor enters demo mode from the landing
- **WHEN** a visitor opens `/` in demo mode and no persona has been entered
- **THEN** the landing SHALL show the persona connection control
- **AND** after selecting a persona the visitor SHALL land on `/overview` acting as that persona

#### Scenario: Demo persona switching remains available after entry
- **WHEN** an entered demo visitor opens the persona switcher in the shell
- **THEN** the switcher SHALL change the active persona and SHALL keep the visitor on the dashboard
- **AND** SHALL NOT route the visitor back to the landing

### Requirement: Demo session enter-state
Demo mode SHALL track a click-only enter state for the current page load: once a persona is selected the visitor is authenticated until the page is reloaded; a reload or fresh visit starts unauthenticated and requires picking a persona again. The enter state SHALL NOT be persisted to storage. It SHALL be distinct from active-persona state (the active persona may change via the switcher without re-entering).

#### Scenario: Demo visitor reloads after entering
- **WHEN** a demo visitor who entered with a persona reloads any dashboard route
- **THEN** the visitor SHALL start unauthenticated
- **AND** SHALL see the connect screen and pick a persona before the dashboard renders

#### Scenario: Demo reset does not clear the enter state
- **WHEN** an entered demo visitor invokes the demo reset action
- **THEN** fixture data SHALL restore to the canonical dataset
- **AND** the enter state SHALL remain for the current page load, so the visitor stays on the dashboard

### Requirement: Demo gating does not alter fixture semantics
The new demo entry requirement SHALL NOT change demo fixture data, synthetic mutation behavior, or the demo adapter boundary defined by this capability. It only establishes when the dashboard becomes visible.

#### Scenario: Demo workflow after entry
- **WHEN** an entered demo visitor performs contribution, proposal, approval, or execution actions
- **THEN** the behavior SHALL match the existing demo adapter contract (synthetic hashes, fixture-only mutations)
- **AND** no wallet transaction or Testnet balance SHALL change