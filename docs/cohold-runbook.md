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
| `NEXT_PUBLIC_STELLAR_CONTRACT_ID` | Wallet mode: Soroban treasury contract ID (`C...`). | empty |
| `NEXT_PUBLIC_STELLAR_CONTRACT_IDS` | Optional comma-separated extra wallet-mode treasury contract IDs. | empty |
| `NEXT_PUBLIC_STELLAR_TOKEN_ID` | Wallet mode: Testnet SAC/token contract ID (`C...`). | empty |

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
`/proposals`, `/proposals/[id]`, `/activity`, `/wallet`.

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

Demo smoke (after `npm run dev`; use the port the dev command printed):

```sh
PORT=3001
for path in / /overview /treasuries /proposals /activity /wallet; do
  curl -s -o /dev/null -w "$path %{http_code}\n" "http://localhost:$PORT$path"
done
```

Expect `200` for each route. The smoke check exercises demo mode end to end
without touching Testnet.

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