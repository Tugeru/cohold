# Cohold — Developer Runbook

**Product:** Cohold (shared treasury with multi-approval spending on Stellar Testnet)
**Repo:** single npm app, Next.js 16 App Router
**Related:** `cohold-prd.md`, `cohold-srs.md`, `cohold-ui-ux-spec.md`, `cohold-mvp-readiness-guide.md`

This runbook is the shortest path from a fresh checkout to a running demo,
and then to wallet mode with a configured Testnet contract.

---

## 1. Environment setup

1. Install dependencies: `npm install` (npm only; the lockfile is
   `package-lock.json`).
2. Copy the template: `cp .env.example .env`.

| Variable | Purpose | Demo default |
|---|---|---|
| `DATABASE_URL` | Optional Postgres DSN. Leave empty to use the in-memory mock fixtures. | empty |
| `NEXT_PUBLIC_COHOLD_MODE` | `demo` or `wallet`. | `demo` |
| `NEXT_PUBLIC_STELLAR_NETWORK` | Must be `TESTNET` for the MVP. Never Mainnet. | `TESTNET` |
| `NEXT_PUBLIC_STELLAR_CONTRACT_ID` | Wallet mode: primary Soroban treasury contract ID (`C...`). | empty |
| `NEXT_PUBLIC_STELLAR_CONTRACT_IDS` | Optional comma-separated additional wallet-mode treasury contract IDs. | empty |
| `NEXT_PUBLIC_STELLAR_TOKEN_ID` | Wallet mode: Testnet SAC/token contract ID (`C...`). | empty |

The committed repository has no deployment-specific contract IDs or wallet
secrets. The fixed Testnet RPC URL, Horizon compatibility URL, and network
passphrase are recorded in `src/lib/stellar.ts`; set the contract/token IDs
only after a known deployment is available.

No secret values are required. The app never holds private keys; Freighter
signs in the browser.

## 2. Run demo mode

```sh
npm run dev
```

The dev command binds port `3001` by default. If `3001` is already in use,
the command selects the next free port (`3002`, `3003`, ...), prints the
selected URL, and never kills the process already holding the port. Open the
printed URL.

Next.js allows one dev server per project: if the process holding `3001` is
another `next dev` for this repository, it prints `Another next dev server
is already running` and exits instead of starting a duplicate. Stop or reuse
that server (the fallback applies when an unrelated process occupies the
port).

Demo mode requires no wallet, no Postgres, and no deployed contract:

- Deterministic fixture treasuries/proposals load from the in-memory mock
  (leave `DATABASE_URL` empty).
- Persona switching is available; every demo mutation (treasury, proposal,
  approval, execute) returns a synthetic transaction hash and submits nothing
  to Testnet.
- Demo reset restores the canonical dataset. Use **Wallet / Settings →
  Reset to Default State** (demo mode only), or
  `POST /api/stellar/reset-demo`. The UI states that no Testnet balance
  changed: the reset touches fixtures only.
- The shell shows a visible Demo / Testnet-simulation status.

One demo-mode exception: the **Get Testnet XLM (Friendbot)** button on
Wallet / Settings requests real Testnet XLM for the active persona address
and does submit a real friendbot transaction. Everything else in demo mode
stays off-chain.

Routes: `/` (landing), `/overview`, `/treasuries`, `/treasuries/[id]`,
`/proposals`, `/proposals/[id]`, `/activity`, `/wallet`, `/settings`.

The route-level error state is a Next.js error boundary rather than a URL.
The smoke loop below exercises a not-found response directly. The app's read
loaders intentionally catch RPC failures and render product-level retry UI;
the focused boundary contract test verifies the `error.tsx` fallback itself.

Demo fixtures are not authorization. Demo state never counts as a wallet
action or confirmation.

## 3. Run wallet mode

Wallet mode drives state through configured Soroban contracts on Stellar
Testnet with Freighter signatures and Stellar RPC reads.

### 3.1 Install and configure Freighter

1. Install the Freighter browser extension.
2. Open Freighter, switch the network to **Testnet**.
3. In the app, connect the wallet. Actions are blocked while disconnected or
   when the wallet is on the wrong network.

### 3.2 Set contract and token IDs

```sh
# .env
NEXT_PUBLIC_COHOLD_MODE=wallet
NEXT_PUBLIC_STELLAR_NETWORK=TESTNET
NEXT_PUBLIC_STELLAR_CONTRACT_ID=C...   # deployed Cohold treasury contract
NEXT_PUBLIC_STELLAR_CONTRACT_IDS=      # optional extra treasuries, comma-separated
NEXT_PUBLIC_STELLAR_TOKEN_ID=C...      # Testnet SAC token contract
```

Contract IDs are the `C...` addresses printed by the Soroban/Stellar CLI
workflow that deployed the contracts. **Each contract instance is one
treasury**; a multi-treasury setup uses one contract per treasury via
`NEXT_PUBLIC_STELLAR_CONTRACT_ID` + `NEXT_PUBLIC_STELLAR_CONTRACT_IDS`.

### 3.3 Fund the wallet

Testnet accounts need a starting balance (fees) and a trustline/balance for
the demo asset. The in-app faucet button and `/api/stellar/faucet` are
demo-mode only (the button is hidden and the route returns `503` in wallet
mode), so in wallet mode fund the address directly with friendbot:
```sh
curl "https://friendbot.stellar.org?addr=G..."
```

### 3.4 What wallet mode supports

Wallet mode reads treasury configuration, members, threshold, balances,
proposals, approvals, and lifecycle status from the Soroban contract through
Stellar RPC. Treasury names and proposal descriptions are contract fields in
the wallet flow; demo-only labels, categories, avatars, and fixture activity
remain local metadata. Postgres and the in-memory mock are metadata/demo
adapters only and never override chain financial or governance state.

- Contribute funds to a treasury (token transfer to the contract).
- Create proposals; **creating a proposal counts as the proposer's
  approval**, so progress starts at 1 of N required.
- Approve proposals (one approval per member) and execute approved payments
  once the threshold is met.
- Read treasury/proposal/approval/balance state from Stellar RPC.

Out of scope in this MVP slice:

- **Create Treasury stays demo-only.** Wallet-mode creation is deferred until
  a follow-on deploy/factory change. Do not present it as a working on-chain
  action.
- Fixture personas and synthetic success paths are unavailable in wallet
  mode. State-changing controls are disabled until contract/token IDs are
  configured (`WalletSetupState` explains the exact gap).

**Testnet/wallet setup must not copy demo fixtures, personas, or synthetic
hashes into wallet state.** Wallet mode reads financial and governance state
from the Soroban contract only; demo data is never a source of truth there.

### 3.5 Automated Testnet integration check

The proposal flow has an opt-in integration test that drives the exact
modules the UI uses (`createProposalFlow`, `approveFlow`, and the SDK
executor) against a live contract, then re-reads state from the chain:
proposer/amount/recipient immutability, `approval_count = 1` at create, the
current user's `has_approved`, the exact-threshold transition to `Approved`,
the contract-level negatives (`NotMember` for outsiders, duplicate
`AlreadyApproved`, `ProposalNotPending`, `ProposalNotFound`), and the
flow-level amount/recipient validation. It covers AGENTS.md's manual Testnet
check before wallet work is called done.

The suite skips itself unless all of the following are set (see
`.env.example`); the deployed contract needs a threshold of 2 with A and B as
members and C funded but not a member:

```sh
COHOLD_TESTNET_CONTRACT_ID=C...   # deployed Cohold treasury (threshold 2)
COHOLD_TESTNET_TOKEN_ID=C...      # its token contract (SAC)
COHOLD_TESTNET_SECRET_A=S...      # funded member
COHOLD_TESTNET_SECRET_B=S...      # funded member
COHOLD_TESTNET_SECRET_C=S...      # funded non-member
npm test -- src/lib/proposal-flow.testnet.test.ts
```

Secrets stay out of the repo (keyring only, per `deploy-testnet.md`); the
test spends real Testnet XLM and is not part of CI.

### 3.6 Live Testnet readiness matrix

`npm run test:testnet` runs the full isolation-and-negatives matrix against
the two deployed treasuries (`deployments/testnet.json`), driving the exact
flow modules the UI uses and re-reading contract state as the source of
truth. It proves the live negatives from the readiness guide — wrong network,
rejected signature, wallet cancel, outsider writes, duplicate approval,
under-threshold execute, approved over-balance execute leaving the proposal
`Approved`, double execute, competing proposals — plus permissionless execute
by a non-member fee-payer and cross-treasury isolation (treasury A churn
never moves treasury B and vice versa). The suite skips itself unless the
secret keys are set:

```sh
export COHOLD_TESTNET_SECRET_A="$(stellar keys secret cohold-member-a)"
export COHOLD_TESTNET_SECRET_B="$(stellar keys secret cohold-member-b)"
export COHOLD_TESTNET_SECRET_C="$(stellar keys secret cohold-outsider)"  # non-member
export COHOLD_TESTNET_SECRET_D="$(stellar keys secret cohold-member-d)"
npm run test:testnet
```

Treasury/token ids default to the public manifest
(`COHOLD_TESTNET_CONTRACT_ID`, `COHOLD_TESTNET_CONTRACT_ID_B`,
`COHOLD_TESTNET_TOKEN_ID` override them). The runner refuses to start when any
secret is missing and the suite asserts live config matches the manifest, so
a stale deployment fails loudly.

The GitHub workflow `.github/workflows/testnet-live.yml` runs the same command
from `workflow_dispatch` using `COHOLD_TESTNET_SECRET_*` repository secrets —
it is protected by design (not triggered on PRs) and is not a required
public PR check.

## 4. RPC history limits

Stellar RPC methods (`getTransaction`, `getEvents`, ...) only cover **the
recent ~7-day window**, and there is no streaming (poll for updates).
Activity lists and confirmation reads are therefore bounded by that window
and by the poll cadence; do not rely on RPC for deep or full history. For
older data beyond the MVP scope, use a Horizon/archive-backed indexer.

## 5. Verification loop (no wallet required)

All commands run without a live wallet, a deployed contract, or Postgres.

```sh
npm run lint        # ESLint (eslint-config-next)
npm run typecheck   # tsc --noEmit, strict
npm test            # Vitest unit suite
npm run build       # production build
```

Contract bindings: `packages/cohold-contract` is generated from the built
Wasm. After changing the Rust contract interface, run
`npm run contract:bindings` and commit the regenerated package — CI fails
when committed bindings drift from the built Wasm interface.

Demo smoke (after `npm run dev`; set `PORT` to the port printed by the
command, which may be `3001` or the next free fallback):

```sh
PORT=<printed-port>
for path in \
  / \
  /overview \
  /treasuries \
  /treasuries/tr-it-society-event-fund \
  /proposals \
  /proposals/prop-venue-deposit-4500 \
  /activity \
  /wallet \
  /settings \
  /does-not-exist; do
  curl -s -o /dev/null -w "$path %{http_code}\n" "http://localhost:$PORT$path"
done
```

Expect `200` for the listed application routes and `404` for
`/does-not-exist`. The smoke check exercises demo mode end to end without
touching Testnet.

Responsive/accessibility spot check (after the smoke loop):

1. Open `/overview`, a treasury detail route, and a proposal detail route at a
   narrow mobile viewport and confirm no horizontal scrolling hides amount,
   asset, recipient, or approval progress.
2. Navigate the primary links and any confirmation dialog with keyboard only;
   confirm visible focus, labeled controls, status text independent of color,
   and focus returning after a dialog closes.
3. Repeat with reduced motion enabled in browser preferences.

The focused boundary contract test in `src/app/demo-boundaries.test.ts`
verifies the client boundary, retry callback, and no-financial-state-change
message. Exercise a live RPC failure in wallet mode to verify the rendered
product-level retry path; it does not intentionally throw into `error.tsx`.

Generated artifacts: `npm run build` writes `.next/`, `tsc` writes
`tsconfig.tsbuildinfo`, and dev/build runs may touch `next-env.d.ts` /
`.next/` types. Treat those as generated framework files: exclude them from
intentional source changes and review the diff for the docs/code edits
separately from generated output.

## 6. Wallet-mode manual checklist (before calling wallet work done)

1. Connect Freighter on Testnet and confirm the configured contract IDs are
   reachable via RPC.
2. Fund the wallet (friendbot) and hold the demo asset/token.
3. Reject a signature: state must not change.
4. Switch to the wrong network: state-changing actions must be blocked.
5. Confirm a transaction: execute a payment and watch it confirm.
6. Attempt a transfer that fails (`InsufficientBalance`, duplicate approval,
   under-threshold execution): proposal/unspent balance must be unchanged.
7. Refresh from RPC and verify the read model matches the confirmed state.