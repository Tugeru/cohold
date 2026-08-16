## Context

Cohold is a Next.js 16.2.6 App Router application using React 19, TypeScript, Tailwind CSS 4, `@stellar/stellar-sdk` 16, `@stellar/freighter-api` 6, Drizzle, and an in-memory mock/Postgres adapter. The current implementation renders the application from `src/app/page.tsx` as one large client component, switches views through local state, fetches database-shaped JSON from route handlers, and supports persona simulation. The PRD, SRS, and UI/UX specification describe a Soroban-authoritative Testnet application, but still contain Vite-era architecture references and do not define a safe seam between demo persistence and on-chain state.

The primary stakeholders are MVP demo users who need to understand shared-fund governance, developers iterating locally with `next dev`, and contract integrators who need the UI to respect Soroban authorization and transaction confirmation semantics.

## Goals / Non-Goals

**Goals:**

- Establish route-level App Router boundaries for the public and authenticated/demo MVP surfaces.
- Give the UI one deep transaction interface that hides wallet, RPC, simulation, signing, submission, polling, and error translation details.
- Make RPC/contract reads the source of truth for financial and governance state in wallet mode.
- Keep local fixtures useful for visual development while making demo mode explicit and non-authoritative.
- Use base-unit integer arithmetic and stable normalized view models across pages.
- Make loading, error, wrong-network, wallet-rejected, confirming, confirmed, and insufficient-balance states first-class responsive UI states.
- Provide a deterministic developer loop on the first free port at or above `3001`.

**Non-Goals:**

- Implementing embedded wallets, passkeys, fiat funding, KYC, Mainnet deployment, dynamic membership, threshold changes, receipts, notifications, or accounting features.
- Treating the existing database API as a second production authority for funds or approvals.
- Designing a complete indexer for historical chain data; RPC reads and recent events are sufficient for the MVP, with deeper history deferred.
- Adding a visual redesign that changes the product's calm, non-cyberpunk fintech direction.

## Decisions

### 1. Use App Router routes as the information architecture

Create shallow routes for `/`, `/overview`, `/treasuries`, `/treasuries/[id]`, `/proposals`, `/proposals/[id]`, `/activity`, and `/wallet`. Shared shell elements live in a route group/layout; interactive controls remain client components below server-rendered page boundaries. URL state, not a root `currentView` state machine, owns navigation and deep links.

**Why:** The UI/UX specification defines these pages and common navigation depth. Route boundaries enable metadata, loading/error/not-found files, smaller client bundles, browser navigation, and isolated page-level verification.

**Alternative rejected:** Keeping a single dashboard route and adding more local view state. This preserves the current coupling, makes refresh/deep links unreliable, and forces all pages into one client bundle.

### 2. Put a deep contract gateway at the wallet/data seam

Define a small typed interface for contract reads and state-changing actions. A browser adapter uses Freighter and Stellar RPC; a fixture adapter supplies deterministic demo data. The gateway owns network configuration, contract ID validation, base-unit conversion, simulation, signing, `sendTransaction`, confirmation polling, and error classification. Pages receive normalized domain view models rather than raw `ScVal`, XDR, database rows, or provider-specific errors.

**Why:** The same financial rules are used by forms, confirmation dialogs, proposal detail, and refresh behavior. Centralizing them creates locality and prevents each component from implementing unsafe partial transaction logic.

**Alternative rejected:** Calling `fetch` to route handlers from every modal. That keeps authority and transaction lifecycle implicit, encourages request-supplied identities, and makes it impossible to guarantee consistent confirmation semantics.

### 3. Keep demo fixtures behind an explicit adapter and environment flag

Use a named development mode such as `NEXT_PUBLIC_COHOLD_MODE=demo` or `wallet`, with a safe default that is visibly labeled Testnet/demo. Demo personas may select fixture actors only in demo mode. Wallet mode derives the actor from the connected wallet and sends real Testnet transactions; it never accepts a body field, UI label, or synthetic signature as authorization evidence.

**Why:** The current persona switcher is valuable for design iteration, but silently mixing it with production-like mutation routes creates a security footgun and invalidates the SRS authorization requirements.

**Alternative rejected:** Removing all mock data immediately. That would slow visual iteration and leave no deterministic state for UI work; explicit adapters preserve velocity without obscuring trust boundaries.

### 4. Use Stellar RPC for new contract interactions

Use RPC for contract reads, simulation, `sendTransaction`, `getTransaction`, and recent contract events. Keep Horizon only for account balance or legacy compatibility where an RPC equivalent is not yet used. Centralize Testnet URLs and passphrase; validate configured contract/token addresses before building a transaction.

**Why:** The data guidance identifies RPC as preferred for new smart-contract applications, and the SRS requires confirmation and authoritative on-chain refresh.

**Alternative rejected:** Expanding the current Horizon-only helper as the contract integration layer. Horizon is not the preferred contract interaction surface and does not provide the required Soroban simulation/submission lifecycle.

### 5. Treat server route handlers as read/proxy infrastructure, not an authority

Server handlers may expose configuration-safe reads or proxy RPC calls where needed, but state-changing wallet actions must carry signed transaction material or be initiated through the client gateway and confirmed on-chain. If demo mutations remain, place them under an explicit demo namespace or guard and label their data as fixture state. Production route handlers must not infer authorization from `creatorAddress`, `approverAddress`, `executorAddress`, `memberLabel`, or `signature` supplied in JSON.

**Why:** Soroban security guidance treats all arguments as attacker-controlled and requires authorization at the address whose authority is consumed. The current handlers violate that model and also have check-then-act and floating-point accounting risks.

### 6. Make money a base-unit value, not a floating-point number

Represent authoritative amounts as validated integer base units, preferably `bigint` in TypeScript and `i128`/compatible contract values at the chain seam. Formatting to human units is a presentation concern. Reject negative, zero, malformed, and out-of-range values before simulation.

**Why:** The SRS explicitly forbids floating-point authoritative calculations. Current handlers use `parseFloat` for balances, contributions, and proposals.

### 7. Design the visual system around governed money, not generic Web3

Use a light mineral canvas, deep ink typography, ledger-blue structural accents, and a restrained signal-orange for attention states. Pair a distinctive editorial display face with a highly legible sans body face and tabular numerals for balances. The memorable signature is a compact “approval rail” that makes the required approvals and current approvals read like a physical control strip. Keep cards quiet, borders precise, focus visible, motion limited to page/transaction state changes, and all status communication redundant to color.

**Why:** This expresses shared financial control and the UI spec's calm, collaborative fintech direction without defaulting to neon crypto styling or a generic dark dashboard.

**Alternative rejected:** Extending the current near-black emerald/cyan palette. It reads as contract tooling and conflicts with the specification's requirement that blockchain stay behind a familiar financial interface.

## Risks / Trade-offs

- [Soroban contract interface/deployment is not present in the repository] -> Build the gateway against a typed contract interface and fixture adapter first; block Testnet acceptance until contract IDs, method names, token contract, and deployment are verified.
- [Changing from mock persistence to on-chain reads can remove rich demo metadata] -> Keep names/descriptions/categories as fixture or optional metadata, but never let them override on-chain amounts, members, approvals, or statuses.
- [RPC has rate limits and limited historical retention] -> Cache stable reads, poll only while a transaction is pending, bound retries, and defer historical audit/indexing to a later capability.
- [Freighter API behavior varies by extension version/browser] -> Isolate the adapter, expose explicit disconnected/wrong-network/rejected states, and retain a deterministic fixture adapter for local UI tests.
- [Route migration can break existing demo links] -> Keep a short-lived redirect or compatibility entry point during migration; verify every UI spec page has a route and a not-found state.
- [Existing generated `next-env.d.ts` and `tsconfig.tsbuildinfo` are modified by prior validation] -> Do not overwrite or revert them as part of this change; inspect the final diff before implementation handoff.
- [Visual polish can outrun financial correctness] -> Order tasks so the contract gateway, base-unit model, and negative security tests precede final styling and acceptance screenshots.

## Migration Plan

1. Add typed network/configuration and money primitives without changing the current visual surface.
2. Add fixture and wallet adapters plus transaction/error lifecycle tests.
3. Route the existing pages through the App Router shell, preserving the current demo dataset through the fixture adapter.
4. Replace client-supplied identity mutation paths with wallet-signed contract operations or explicitly guarded demo handlers.
5. Switch wallet mode reads to RPC and verify the complete Testnet flow: create treasury, contribute, create proposal, approve, execute, refresh.
6. Add responsive/accessibility/performance verification and update the PRD/SRS/UI docs to reference Next.js App Router, RPC, and the final MVP mode boundary.

Rollback is by feature flag: keep demo mode available for UI iteration while wallet mode is disabled until contract configuration and Testnet acceptance pass. Do not roll back by re-enabling unguarded production-like database mutations.

## Open Questions

- What is the deployed Cohold contract ID, token/SAC contract ID, network RPC endpoint, and exact contract method/return shape for the MVP Testnet deployment?
- Are treasury names and proposal descriptions stored on-chain, emitted as events, or intentionally fixture-only for the MVP?
- Does proposal creation count the proposer as an approval on-chain, or must the proposer explicitly approve as a separate transaction? The current code assumes automatic approval, while the SRS says creators may approve their own proposals but does not require automatic approval.
- Which activity history is required for MVP acceptance when RPC's recent-event retention is insufficient?
- Should the existing Postgres schema be retained only for optional metadata/audit indexing, or removed from the MVP runtime path entirely?
