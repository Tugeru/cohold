## Why

Cohold has a broad MVP product and UX specification, but the current implementation is still a single client-rendered dashboard backed by request-supplied identities and mock database mutations. That makes the prototype useful for visual iteration, yet it does not provide a trustworthy front end for the Soroban contract, and the current structure prevents route-level loading, metadata, deep-linking, and focused verification. This change establishes the front-end foundation needed to reach the MVP end to end without allowing demo shortcuts to masquerade as contract-authoritative behavior.

## What Changes

- Replace the single client-owned navigation state with an App Router page model for the public landing page, overview, treasuries, treasury detail, proposals, proposal detail, activity, and wallet/settings contexts.
- Establish a small, deep client transaction module that owns wallet detection, network validation, contract configuration, simulation, signing, submission, confirmation polling, and human-readable error mapping.
- Make Stellar RPC the authoritative read path for treasury, proposal, approval, and balance state; keep Horizon limited to supported account or legacy lookups.
- Gate all state-changing MVP actions on a connected Testnet wallet and contract transaction lifecycle; do not record client-supplied labels, signatures, or addresses as proof of authorization.
- Separate demo fixtures and persona switching from production transaction paths with an explicit development/demo mode and visible Testnet/demo status.
- Establish integer/base-unit financial handling, route-level loading/error/not-found states, accessible responsive interaction states, and a repeatable dev-server/test workflow.
- Preserve the PRD/UI scope boundaries: no fiat rails, dynamic governance, embedded wallets, receipt uploads, or advanced organization features in this MVP change.

## Capabilities

### New Capabilities

- `nextjs-app-shell`: Route structure, shared application shell, responsive navigation, metadata, loading/error/not-found states, and page-level data boundaries for the MVP.
- `stellar-transaction-flow`: Freighter/Testnet connection, network validation, Soroban simulation/signing/submission/confirmation lifecycle, and safe error presentation for financial actions.
- `contract-authoritative-read-model`: RPC-backed reads and normalized view models for treasury, proposal, approval, balance, and activity state, with no client-controlled authority claims.
- `demo-development-mode`: Explicit mock/demo fixtures, persona simulation, deterministic reset behavior, and a documented port-aware development loop that cannot be confused with production wallet behavior.

### Modified Capabilities

- None. No existing OpenSpec capability specs are present; the PRD, SRS, and UI/UX documents are the current source requirements.

## Impact

- Affected app routes and components under `src/app`, `src/components`, and `src/context`.
- New client/server seams under `src/lib` for network configuration, contract reads, transaction lifecycle, error mapping, and base-unit money handling.
- Existing API routes under `src/app/api` must stop presenting database mutations as Soroban authorization or become clearly scoped demo-only adapters.
- `src/db` and demo seed data remain useful for local fixtures but must not be the authoritative path for financial state in the MVP wallet flow.
- Environment configuration, dependency boundaries, lint/typecheck/build scripts, and developer documentation will be updated for Next.js 16 App Router and Stellar SDK v16.
- Verification expands to contract-client unit tests, transaction lifecycle tests, route/page smoke tests, responsive/accessibility checks, and an end-to-end Testnet demo checklist.
