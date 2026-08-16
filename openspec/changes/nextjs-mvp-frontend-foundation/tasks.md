## 1. Contract and Environment Discovery Gate

- [ ] 1.1 Record the deployed Cohold contract ID, token/SAC contract ID, Testnet RPC URL, network passphrase, and deployment revision in a non-secret environment/config document.
- [ ] 1.2 Confirm the exact contract method names, argument types, return shapes, proposal-approval semantics, emitted event topics, and read strategy against the deployed contract or authoritative contract source.
- [ ] 1.3 Add typed environment validation that fails wallet mode before rendering state-changing controls when required contract/network configuration is absent or malformed.
- [ ] 1.4 Decide and document whether treasury names/descriptions and proposal descriptions are on-chain, event-derived, or fixture-only, and whether Postgres remains metadata/indexing-only.

## 2. Financial and Contract Gateway Foundations

- [ ] 2.1 Add a base-unit money module using validated integer/`bigint` values, token decimals, exact formatting, and rejection of invalid or out-of-range input.
- [ ] 2.2 Add centralized Stellar network configuration for Testnet RPC, optional Horizon compatibility, passphrase, contract IDs, and explicit `demo`/`wallet` mode.
- [ ] 2.3 Define normalized treasury, member, proposal, approval, transaction, and activity view models that do not expose raw ScVal/XDR/provider rows to UI modules.
- [ ] 2.4 Define the contract gateway interface for reads and state-changing operations, including typed operation context and normalized error results.
- [ ] 2.5 Implement the RPC read adapter for treasury/proposal/balance/approval state once contract interface details are verified.
- [ ] 2.6 Implement transaction preparation, simulation, wallet signing, RPC submission, confirmation polling, and post-confirmation refresh behind the gateway.
- [ ] 2.7 Implement stable error mapping for wrong network, wallet rejection, missing account funds, invalid amount/recipient, non-member, duplicate approval, threshold, insufficient balance, and already-executed errors.

## 3. Demo Adapter and Security Boundary

- [ ] 3.1 Define the demo adapter interface and move fixture/persona/reset behavior behind it without changing the canonical demo dataset.
- [ ] 3.2 Add an explicit visible demo-mode indicator and disable fixture persona switching and synthetic success paths in wallet mode.
- [ ] 3.3 Guard or namespace existing database mutation routes so they cannot be called as wallet-mode financial operations.
- [ ] 3.4 Remove request-body identity/signature fields as wallet authorization evidence; derive wallet actors from the connected wallet and Soroban authorization.
- [ ] 3.5 Replace or isolate `parseFloat` financial mutations and add negative tests for altered actors, duplicate approval races, double execution, cross-treasury balance use, and stale confirmation.
- [ ] 3.6 Ensure demo reset is deterministic, fixture-only, and visibly unrelated to Testnet state.

## 4. Next.js App Router Shell

- [ ] 4.1 Create the public landing route and shared metadata aligned with the Cohold product/UX specification.
- [ ] 4.2 Create route-level overview, treasuries, treasury detail, proposals, proposal detail, activity, and wallet/settings pages with route-specific loading, error, and not-found states.
- [ ] 4.3 Replace root local view switching with URL-based navigation while preserving a compatibility entry point for the existing demo flow during migration.
- [ ] 4.4 Split server-compatible page data/loading from client-only wallet controls, dialogs, and transaction state.
- [ ] 4.5 Add shared shell primitives for desktop sidebar, mobile navigation, header network/wallet context, page container, and contextual actions.
- [ ] 4.6 Add route-level data cache/revalidation decisions and prevent stale optimistic financial state after mutations.
- [ ] 4.7 Resolve the existing React lint failures in the root shell, activity view, and wallet context without suppressing the React Compiler rules.

## 5. MVP Workflow Integration

- [ ] 5.1 Integrate wallet connect/disconnect and Testnet detection using the centralized wallet adapter.
- [ ] 5.2 Implement Create Treasury review and transaction flow with creator membership and threshold validation.
- [ ] 5.3 Implement Add Funds review, wallet authorization, confirmation, and authoritative balance refresh.
- [ ] 5.4 Implement Create Proposal review with immutable amount/recipient display and verified proposer authorization.
- [ ] 5.5 Implement Proposal Detail approval progress, current-user approval state, duplicate prevention, and confirmation lifecycle.
- [ ] 5.6 Implement permissionless Execute Payment only after contract simulation confirms approval and solvency, with exact payment confirmation.
- [ ] 5.7 Add insufficient approval, insufficient balance, wrong network, rejected signature, failed transaction, and stale refresh UI states.
- [ ] 5.8 Make Activity and audit presentation distinguish verified Testnet activity from demo fixture activity and recent-history limitations.

## 6. Visual and Interaction Pass

- [ ] 6.1 Replace the current generic dark contract-tooling treatment with the governed-money visual system defined in `design.md` and the UI/UX specification.
- [ ] 6.2 Establish typography, color, spacing, radius, focus, status, and tabular-number tokens with the approval rail as the signature interaction.
- [ ] 6.3 Implement mobile-first treasury/proposal layouts, full-width financial confirmations, responsive table-to-card transformations, and sticky mobile actions where appropriate.
- [ ] 6.4 Add semantic labels, focus management, keyboard-safe dialogs, screen-reader status updates, reduced-motion handling, and non-color status indicators.
- [ ] 6.5 Add deliberate empty, loading, blocked, error, and success copy using the product vocabulary from the UI/UX specification.
- [ ] 6.6 Verify that all financial confirmation surfaces show treasury, asset, amount, recipient, approval rule, and current approval state before signing.

## 7. Developer Loop and Verification

- [ ] 7.1 Add a documented `next dev` command that starts at port `3001` and selects the next free port without terminating existing processes.
- [ ] 7.2 Add a fast demo smoke check for the landing, overview, treasury detail, proposal detail, error, and not-found routes.
- [ ] 7.3 Add unit tests for base-unit money, network configuration, error mapping, adapter normalization, and transaction lifecycle state transitions.
- [ ] 7.4 Add integration tests for demo-mode mutations and negative authorization/security cases at the correct gateway/route seam.
- [ ] 7.5 Add wallet/Testnet manual acceptance steps for connect, wrong network, rejected signature, confirmed transaction, failed transaction, and post-confirmation refresh.
- [ ] 7.6 Run lint, typecheck, production build, demo smoke checks, and responsive/accessibility checks; record generated framework-file changes separately from source changes.

## 8. MVP Acceptance and Documentation Alignment

- [ ] 8.1 Execute the PRD demo scenario end to end on Stellar Testnet with a known contract deployment.
- [ ] 8.2 Verify treasury creation, contribution, proposal creation, one-approval-per-member, threshold gating, exact recipient/amount, insufficient balance, double execution, and cross-treasury isolation behavior.
- [ ] 8.3 Update the PRD, SRS, and UI/UX specification to replace Vite references with Next.js App Router, clarify RPC authority, define demo/wallet mode, and resolve proposer-approval semantics.
- [ ] 8.4 Produce a short MVP runbook covering environment setup, port selection, wallet prerequisites, Testnet funding, contract configuration, reset/demo behavior, and known RPC history limits.
- [ ] 8.5 Run `openspec validate --change nextjs-mvp-frontend-foundation` and complete the change only when all artifact and acceptance checks pass.
