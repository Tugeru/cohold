## 1. Authentication Predicate and Wallet State

- [x] 1.1 Add `src/lib/auth-gate.ts` with pure `isAuthenticated(config, session)` and `authenticationBlockReason(config, session)` implementing the mode-aware definition from the `wallet-authentication-gate` spec (wallet: connected ∧ Testnet passphrase ∧ diagnostics healthy; demo: `demoEntered`), using the existing `walletActionBlockReason` precedence (setup incomplete → diagnostics failed → diagnostics checking → not connected → wrong network)
- [x] 1.2 Extend `WalletContext` with `demoEntered: boolean` (in-memory, click-only, never restored from storage) and `enterDemo(persona)` that sets the active persona and the flag; keep `setActivePersona` semantics unchanged for post-entry switching
- [x] 1.3 Add unit tests for `isAuthenticated`/`authenticationBlockReason`: demo entered/not-entered, wallet connected-on-wrong-network (must be blocked), diagnostics failed, diagnostics still checking, and connected-on-Testnet-healthy (allowed)

## 2. Provider Lift to Root

- [ ] 2.1 Move `WalletProvider` from `src/app/(demo)/layout.tsx` to `src/app/layout.tsx`; keep `DemoDataProvider` and `DemoShell` in the `(demo)` layout
- [ ] 2.2 Confirm the landing page still server-renders without Freighter (no `window`/extension access during SSR) with the provider above it — smoke `/` and `/overview` after the move

## 3. Landing Connect Control

- [x] 3.1 Build the `LandingConnect` client island for `src/app/page.tsx`: wallet mode → `connectFreighter()` with inline `walletStatus`/`walletMessage` feedback (install, wrong-network, connecting); demo mode → compact persona picker → `enterDemo(persona)`; on success `router.push('/overview')`
- [x] 3.2 Replace the landing CTA block (`View Demo`/`Create Treasury`/`Open Treasuries`/`Open Wallet` links) with `LandingConnect`; keep `Create Treasury` reachable from the dashboard after entry
- [x] 3.3 Extract a shared `ConnectCard`/message primitive if the connect visuals duplicated between `LandingConnect`, `ConnectScreen`, and the wallet page exceed a few lines

## 4. Shell Authentication Gate

- [x] 4.1 Add the gate to `DemoShell`: render a mode-aware `ConnectScreen` (wallet connect CTA with install/wrong-network/diagnostics messaging, demo persona picker) instead of `children` while unauthenticated; keep the connect state during an in-flight connect click
- [x] 4.2 Route to `/overview` with `router.replace` after connecting from the gate (both modes); no attempted-path restoration
- [x] 4.3 Reconcile responsibilities with `WalletSetupState`/`useWalletResourceGate`: shell gate owns identity/network; per-view resource gate keeps contract-health blocking; update comments so the split is documented
- [x] 4.4 Gate `/wallet`/`/settings` like every other route and verify no dead-end: connecting from the gated `/wallet` lands on `/overview`

## 5. Tests, Docs, and Verification

- [x] 5.1 Update `src/app/demo-boundaries.test.ts` and any dashboard-content assertions for the gate: unauthenticated renders connect screen, authenticated renders dashboard; keep the runbook curl smoke loop green (in-place gate, 200s)
- [x] 5.2 Update docs: MVP readiness guide first-time flow is now implemented; runbook §2/§3 walkthroughs start from the connect flow; note demo enter-state and that unauthenticated read-only browsing is gone
- [x] 5.3 Run `npm run lint`, `npm run typecheck`, `npm test`; manual wallet-mode check: connect from landing → `/overview`, wrong network blocked — and no auto-authentication: a fresh load always starts on the connect screen until the visitor clicks Connect (or picks a persona in demo mode)

## 6. Wallet Overview (mode-aware dashboard)

- [x] 6.1 Add `src/lib/wallet-overview.ts` with pure `buildWalletOverview(input) → WalletOverviewData`: totals in base units (null balance reads skipped), needs-my-approval limited to pending proposals in verified-member treasuries with `currentUserApproval === "not-approved"`, ready-to-disburse, recently-executed (capped, newest first), and isolated failure lists
- [x] 6.2 Add unit tests for `buildWalletOverview`: balance summing, failed-read exclusion, proposal-list failure exclusion, membership/approval filtering, non-member and unknown-approval exclusions, no-wallet state, execution caps, empty input
- [x] 6.3 Branch `/overview` route on mode (`coholdConfig.mode === "wallet"` → `WalletOverviewView`; demo path unchanged)
- [x] 6.4 Build `WalletOverviewView`: reads every configured contract (`loadWalletTreasury` + `loadWalletProposalViews`), renders KPI cards (total funds, active treasuries, needs my approval, ready to disburse), actionable sections deep-linking to approve/execute/add-funds/new-proposal routes, failure tiles, empty state
- [x] 6.5 Add `WalletCreateTreasuryDialog` with a live in-browser deploy flow (upload Wasm → create instance → initialize, each simulated then signed in Freighter), local registry registration on success, and friendly validation/progress/failure states
- [x] 6.6 Update `demo-boundaries.test.ts`: wallet overview branch assertions, single-dashboard-route assertion, `WalletCreateTreasuryDialog` focus-trap coverage
- [x] 6.7 Update docs (`cohold-mvp-readiness-guide.md`, `cohold-runbook.md`, `deploy-testnet.md`) and this change's specs/proposal/design: both modes land on `/overview`; wallet overview is chain-driven and actionable; in-app creation deploys on-chain

## 7. In-App Treasury Deployment

- [x] 7.1 Add `src/lib/treasury-deploy.ts`: `validateTreasuryDetails`, `createTreasuryDeployFlow` (upload → create → initialize stages, each prepare/sign/submit/confirm, typed failure outcomes), `stellarTreasuryDeployExecutor` (SDK upload op, `contract.Client.deploy`, bindings `Client.initialize`)
- [x] 7.2 Add `src/lib/treasury-registry.ts` (localStorage registry) and merge it into every wallet contract-id surface (overview, treasuries list, activity, treasury detail, proposal routing)
- [x] 7.3 Ship the reviewed Wasm at `public/cohold.wasm` (built from `contracts/cohold`) for browser fetch
- [x] 7.4 Unit tests for validation, stage ordering, sign/submit/confirm failure mapping, registry merge/routing
- [ ] 7.5 Full verification: lint, typecheck, tests, live route compile on the dev server