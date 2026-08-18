## Context

Cohold's identity is the connected wallet address (wallet mode) or the active demo persona (demo mode). Today the landing page (`src/app/page.tsx`, server component, no providers) links straight into the dashboard: demo mode offers "View Demo"/"Create Treasury", wallet mode "Open Treasuries"/"Open Wallet". Every dashboard route lives in the `(demo)` route group wrapped by `WalletProvider → DemoDataProvider → DemoShell`; the provider already tracks `isFreighterConnected`, `freighterAddress`, `walletStatus` (`disconnected | connecting | connected | wrong-network | cancelled | error`), `isWalletNetworkAllowed`, `walletDiagnostics`, and auto-restores on mount (`restoreFreighter`). Read views render for anyone; state-changing controls are gated by `canPerformStateChange`/`walletActionBlockReason`. The MVP readiness guide section 4 prescribes an identity-first first-time flow that the app currently does not implement.

Constraint: the archived `nextjs-app-shell` spec requires the public landing to render server-side without wallet APIs, and the current demo-mode spec requires wallet-free demo walkthroughs.

## Goals / Non-Goals

**Goals:**
- Landing page hosts the connect action in both modes and routes to `/overview` on success in both modes.
- `/overview` in wallet mode renders a chain-driven wallet overview (configured treasury contracts + proposals from RPC) that is actionable, not the demo gate.
- Any dashboard route renders a connect screen instead of content while unauthenticated (in-place gate, no redirect-only connect route).
- "Authenticated" is one pure, unit-testable predicate; identity state reuses `WalletContext` (no parallel sign-in store).
- Demo mode's persona selection becomes its login; the choice is click-only for the current page load (a reload asks again).
- Landing stays server-rendered; the connect control is a client island.

**Non-Goals:**
- No server-side auth, sessions with expiry, or auth middleware (contract authorization remains authoritative).
- No Freighter `ACCOUNT_CHANGED`/`NETWORK_CHANGED` event listeners; mid-session account switches re-evaluate on next state change.
- No attempted-path preservation after connect (always `/overview`, per decision).
- No changes to fixture/synthetic demo semantics.
- **In-app Create Treasury deploys on-chain from the connected wallet.** This reverses the earlier "CLI-only" non-goal: browser deployment of a fresh Cohold instance is a supported wallet-mode action (three simulated, signed transactions: upload Wasm, create instance, initialize), which registers the new contract id locally so no env edit or restart is needed. CLI deploys remain available for scripted setups.
- No new shadcn dependency (repo has no `components.json`; keep the existing Tailwind primitives and the landing's current design language).

## Decisions

### 1. Move `WalletProvider` to the root layout
Currently `WalletProvider` sits in `src/app/(demo)/layout.tsx`, so the landing (outside the group) cannot connect. Move it to `src/app/layout.tsx`, keeping `DemoDataProvider` in the `(demo)` layout. A client provider wrapping server children renders fine — Freighter is only touched inside effects/handlers after hydration, never during SSR, preserving the landing's server-renderability.
- Alternative rejected: keep the provider in `(demo)` and make landing link to the gate — rejected because the requirement is connect-on-landing.
- Alternative rejected: dedicated `/connect` route — redundant; the in-place gate is its own screen (YAGNI, and the shell spec requires no separate connect URL).

### 2. Single pure authentication predicate in `src/lib/auth-gate.ts`
`isAuthenticated(config, session) → boolean` and `authenticationBlockReason(config, session) → string | null`, where `session` carries `{ connected, networkAllowed, diagnostics, demoEntered, mode }`. Wallet mode: connected ∧ Testnet passphrase ∧ diagnostics healthy; demo mode: `demoEntered`. The block reason mirrors the existing `walletActionBlockReason` precedence (setup incomplete → diagnostics failed → diagnostics null/checking → not connected → wrong network) so the gate and the mutations share one vocabulary. Unit-testable without React; covers the wrong-network nuance (`applyConnectionResult` sets `connected=true` even for wrong-network, so connected alone is insufficient).
- Alternative rejected: inline the check in the gate component — untestable without rendering.

### 3. Demo enter-state lives in `WalletContext` (`demoEntered` + `enterDemo(persona)`)
The landing island must set active persona AND mark entry; the shell gate must read both. WalletContext already owns `activePersona`/`setActivePersona`/`personas`; adding `demoEntered` (in-memory, click-only, never restored) and `enterDemo(persona)` (sets persona + flag) keeps one provider, one source of truth. No new context, no storage: every fresh page load starts unauthenticated.
- Alternative rejected: new `DemoEntryContext` at root — parallel state, extra provider, same data.

### 4. `ConnectGate` renders in-place inside `DemoShell`
`DemoShell` (client) checks the predicate before rendering `children`: unauthenticated → render a `ConnectScreen` (mode-aware: wallet connect CTA with install/wrong-network/diagnostics messaging; demo persona picker); authenticated → children. No route redirects, no middleware. The shell also owns the post-connect `router.replace('/overview')` (`replace`, so back does not return to the gate) for both modes: demo renders the persona dashboard there, wallet mode renders the new chain-driven `WalletOverviewView`. `/overview` is no longer a dead end in wallet mode, so a single dashboard route works for both modes.
- Alternative rejected: middleware/proxy — server-side and cannot read Freighter state.
- Alternative rejected: routing wallet mode to `/treasuries` — the pre-overview behavior that left `/overview` as a read-only dead end; the user-facing dashboard requirement is that the overview works for real contracts.

### 5. Landing connect island `LandingConnect`
A client component embedded in the server landing page, replacing the current four-CTAs block with one connect control that branches on mode: wallet mode → `connectFreighter()` with inline `walletStatus`/`walletMessage` feedback; demo mode → compact persona picker → `enterDemo(persona)`. On success → `router.push('/overview')`. Reuses the same presentational pieces as `ConnectScreen` (extract a shared `ConnectCard` if the duplication exceeds a few lines).
- Alternative considered: keep `Open Treasuries`/`View Demo` links and gate only in the shell — rejected: landing must make connect the explicit entry per the readiness flow and the user's direction.

### 6. Landing CTAs collapse to the connect control
The current `Link` pairs ("View Demo"/"Create Treasury" in demo; "Open Treasuries"/"Open Wallet" in wallet) are replaced by `LandingConnect`. Create Treasury remains reachable from the dashboard after entry (the demo create modal lives in the shell; wallet mode has its own deploy-guidance dialog on the wallet overview) — no dead-end for either mode's create path.

### 7. Wallet-mode overview at `/overview`
The route page (`src/app/(demo)/overview/page.tsx`) branches on `coholdConfig.mode`: demo keeps the existing persona dashboard, wallet mode renders `src/components/WalletOverviewView.tsx`. The view reads each `configuredContractIds` entry via `loadWalletTreasury` + `loadWalletProposalViews` (passing the connected address for approval state) and assembles the dashboard model in a pure module, `src/lib/wallet-overview.ts` (`buildWalletOverview`), so KPIs are unit-testable without React or RPC:

- **Totals** — sum of loaded balances in base units; a failed balance read is skipped, never invented; display metadata (symbol/decimals) comes from the first loaded treasury with known token info.
- **Needs my approval** — pending proposals in treasuries where the connected wallet is a verified member and `currentUserApproval === "not-approved"`. `unknown` and disconnected states never count as actionable.
- **Failure isolation** — one unreadable contract renders a labeled error tile (like the treasuries list) and is excluded from totals; healthy treasuries stay visible.
- **Actions** — proposal rows deep-link to the existing approve/execute dialogs (`walletProposalHref`), treasury cards to the add-funds/new-proposal page. Create Treasury opens `WalletCreateTreasuryDialog`, a live deployment flow from the connected Freighter wallet: upload the reviewed Wasm (`Operation.uploadContractWasm`, fetched from `/cohold.wasm`), deploy a fresh instance (`contract.Client.deploy`, id derived from the wallet address + salt + wasm hash), and initialize members/threshold/name via the generated bindings — three transactions, each simulated before signing, Testnet XLM fees from the wallet. On success the new contract id is registered in a local registry (`src/lib/treasury-registry.ts`) that every wallet surface merges with the env-configured ids, so the new treasury appears on the overview, `/treasuries`, `/activity`, the treasury detail, and proposal routing immediately. CLI deploys remain supported for scripted setups.

- Alternative rejected (earlier): deploy-and-configure guidance text only — the user-facing requirement is that creating a treasury works in the browser against real contracts, with the same sign-in-Freighter flow as every other action.

## Risks / Trade-offs

- **Provider lift changes the landing bundle** — the root layout now mounts a client provider; the landing gains a hydrated island. Mitigation: keep the island small; landing content and metadata remain server-rendered, and the provider never calls Freighter on mount (no auto-restore), so the landing spec scenario holds.
- **Demo enter state is session/single-tab scoped** — two tabs can hold different entered personas; out of scope for the MVP and harmless for demo walkthroughs.
- **Read-only browsing disappears for unauthenticated visitors** — intentional per proposal, but it reverses today's "non-members can read if they can see the UI" behavior; the readiness guide first-time flow is now actually implemented.
- **Test churn** — `demo-boundaries.test.ts` and any content assertions on dashboard routes assume immediate content; they must be updated for the gate. The runbook curl smoke loop stays green because the gate renders in place (200), not a redirect.
- **`/wallet` is gated too** — it is the settings surface for connected users; unauthenticated visitors reaching it see the connect screen (which is where they connect), so no dead-end: connect on `/wallet` → `/overview`.
- **No silent sessions** — the provider does not auto-restore Freighter on mount, and routing is armed only by an explicit connect click, so a returning visitor is never authenticated without acting. Freighter still remembers the site grant, so clicking Connect is a single, permission-free step.