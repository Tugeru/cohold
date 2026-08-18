## Why

Cohold's identity is the wallet address, but today a visitor lands on the dashboard without ever connecting: they can roam treasuries, proposals, and activity read-only, and wallet connection is buried on `/wallet`. The MVP readiness guide (section 4) prescribes an identity-first flow — Landing → Connect Wallet → Freighter Permission → Verify Testnet → Dashboard — and the live demo depends on the presenter signing as a specific member. The dashboard must be reachable only after identity is established: Freighter connect on Testnet in wallet mode, persona selection in demo mode.

## What Changes

- Landing page (`/`) gains an interactive **Connect Wallet** control in both modes. In wallet mode it connects Freighter and verifies Testnet; in demo mode it connects a persona (persona picker = the demo login). On success the app routes to `/overview`.
- The `(demo)` shell gains an **auth gate**: any app route (`/overview`, `/treasuries*`, `/proposals*`, `/activity`, `/wallet`, `/settings`) renders a connect screen instead of the dashboard while unauthenticated. After connecting from the gate, the user is routed to `/overview` (always — no attempted-path preservation).
- **Wallet mode** "authenticated" means: Freighter connected + Testnet network + wallet resources healthy (existing `walletDiagnostics`). Wrong network, missing extension, or failed diagnostics render the specific blocker message, reusing the existing setup-state visuals.
- **Demo mode** "authenticated" means: the user has entered by picking a persona. Entry is click-only and scoped to the current page load — a fresh load or reload asks to connect again, so nobody is authenticated without having clicked.
- The wallet provider moves up to the root layout so the landing page can host the connect action; the landing remains server-rendered with the connect control as an interactive client island (no Freighter API touched during SSR).
- Landing CTAs change: wallet mode's "Open Treasuries"/"Open Wallet" become a single "Connect Wallet" primary action; demo mode's "View Demo" becomes the persona connect flow.
- Post-connect destination is `/overview` in both modes: demo renders the persona dashboard; wallet mode renders the new chain-driven wallet overview at that route (no more read-only dead end).
- **BREAKING** (UX, not data): unauthenticated visitors can no longer browse the dashboard read-only; `/wallet` is gated like every other app route.
- **Wallet overview**: `/overview` in wallet mode is no longer the demo gate. It reads every configured treasury contract and its proposals from RPC, shows the same KPI and action surfaces as the demo dashboard (total funds, active treasuries, needs my approval, ready to disburse, recently executed), and links into the existing on-chain actions (add funds, propose, approve, execute) on the treasury and proposal routes. **Create Treasury deploys a real Cohold instance on Testnet from the connected Freighter wallet** — upload Wasm, create the instance, initialize members/threshold/name, then register the new contract id locally so it appears across wallet surfaces without an env edit or restart.
- Docs updated: MVP readiness guide flow is now actually implemented; runbook demo/wallet walkthroughs updated to start from the connect flow and land on `/overview`.

## Capabilities

### New Capabilities
- `wallet-authentication-gate`: identity-first entry — landing connect control, shell auth gate, mode-aware "authenticated" definition, and post-connect routing to `/overview`.

### Modified Capabilities
- `nextjs-app-shell`: landing page keeps its server-renderability but the public-landing scenario gains an interactive connect island; the shared shell owns the auth gate as part of route-level behavior; the wallet-mode `/overview` route renders the chain-driven wallet overview instead of the demo gate.
- `contract-authoritative-read-model`: wallet-mode dashboard assembly (multi-treasury overview KPIs from chain reads) is added as a pure, unit-tested module.
- `demo-development-mode`: demo mode gains a persona-connect entry on the landing and a session enter-state; fixtures/persona semantics otherwise unchanged.