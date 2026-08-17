# Cohold

Shared funds. Shared control. Next.js 16 App Router frontend for a multi-approval treasury on Stellar Testnet.

This is a single npm app (not a pnpm/turbo monorepo). The package name in `package.json` is still the template name `nextjs-postgresql-template` — treat the product as **cohold**.

## Dev environment tips

- Copy `.env.example` to `.env`. `DATABASE_URL` is optional: unset means the in-memory mock in `src/db/mock.ts` (demo fixtures from `src/lib/db-seed.ts`). Set it only when you need real Postgres.
- `NEXT_PUBLIC_STELLAR_NETWORK` is required for wallet-facing work (`TESTNET` for the MVP). Never point the app at Mainnet.
- Install with `npm install`. The lockfile is `package-lock.json` — do not introduce pnpm or yarn.
- Start the app with `npm run dev`. Prefer port `3001` (or the next free port). Do **not** run `npm run build` inside an agent session; it rewrites `.next` and breaks HMR.
- Import via the `@/*` alias (`tsconfig.json` maps it to `./src/*`). Do not use long relative paths.
- Layout:
  - `src/app` — App Router pages and `src/app/api/*` route handlers
  - `src/components` — client UI
  - `src/context` — wallet/persona state
  - `src/db` — Drizzle schema + mock/Postgres adapter
  - `src/lib` — Stellar helpers, personas, seed, contract source
  - `src/types` — shared domain types
  - `docs/` — PRD, SRS, UI/UX spec, developer runbook
  - `openspec/` — spec-driven change artifacts
  - `cohold-summary.md` — product, roles, and flows in one place
- Current UI still lives in one client shell (`src/app/page.tsx` + local `currentView` state). Target routes from the OpenSpec change: `/`, `/overview`, `/treasuries`, `/treasuries/[id]`, `/proposals`, `/proposals/[id]`, `/activity`, `/wallet`.
- Schema lives in `src/db/schema.ts`. After schema edits, update `drizzle.config.json` consumers and the mock query surface in `src/db/mock.ts` so both backends stay interchangeable.
- Wallet work uses Freighter (`@stellar/freighter-api`) and `@stellar/stellar-sdk`. Use Stellar RPC (`src/lib/stellar.ts`) for contract reads, simulate, submit, and confirm. Keep Horizon for account/legacy lookups only.
- Demo personas in `src/lib/personas.ts` are for fixture walks only. In wallet mode the actor is the connected Testnet wallet, never a request-body address or label.
- Product and visual source of truth: `docs/cohold-prd.md`, `docs/cohold-srs.md`, `docs/cohold-ui-ux-spec.md`. Active implementation plan: `openspec/changes/nextjs-mvp-frontend-foundation/`.
- Use the matching skill instead of improvising: OpenSpec changes (`.pi/skills/openspec-*`), Stellar client (`dapp`, `data`), contracts (`smart-contracts`), Next.js (`next-best-practices`, `next-dev-loop`), UI (`frontend-design`, `emil-design-eng`), tests (`tdd`), review (`code-review`).

## Testing instructions

- There is no `.github/workflows` CI and no `test` script yet. Until those exist, the merge gate is `npm run lint` and `npm run typecheck`. Both must be green.
- After moving files or changing imports, re-run `npm run lint` and `npm run typecheck`. ESLint is `eslint-config-next` (core-web-vitals). TypeScript is strict.
- Next.js 16 route handlers receive `params` as a `Promise` — always `await props.params`. Do not add `eslint-disable` for React Compiler / hooks rules; fix the component instead.
- Add tests for the code you change, even if nobody asked. When a runner is added, prefer Vitest unit tests next to the module (`src/lib`, gateway, money, error mapping) and keep a `npm test` script in `package.json`.
- Cover these first: base-unit money (no `parseFloat` on authoritative amounts), network/config validation, adapter normalization, transaction lifecycle, one-approval-per-member, threshold gating, insufficient balance, double execute, and cross-treasury isolation.
- Demo/mock mutations are not proof of authorization. Negative tests should try swapped actors, client-supplied signatures, duplicate approvals, and stale confirmation.
- Manual Testnet check before calling wallet work done: connect Freighter, reject a signature (state unchanged), wrong network (actions blocked), confirmed tx, failed transfer (proposal stays unexecuted), then refresh from RPC.
- Do not treat Postgres or the in-memory mock as the source of truth for balances, members, threshold, approvals, or execution. The Soroban contract is authoritative; DB/fixtures are metadata or demo only.
- Verify OpenSpec work with `openspec validate --change <name>` and the `openspec-verify-change` skill before archive.

## PR instructions

- Title format: `[cohold] <Title>`
- Commits use conventional prefixes already in this repo (`feat:`, `fix:`, `docs:`, `chore:`). Keep the subject imperative and scoped to one change.
- Always run `npm run lint` and `npm run typecheck` before committing. When `npm test` exists, run that too. Do not commit with red checks.
- Prefer an OpenSpec change for anything that alters product behavior. Workflow is spec-driven: proposal → capability specs → design → tasks → implement → verify → archive. Use `.pi/skills/openspec-*`; do not skip artifacts.
- Active change: `nextjs-mvp-frontend-foundation`. Continue it instead of opening a parallel foundation change.
- Keep MVP scope. Out of scope: fiat rails, Mainnet, dynamic membership/threshold, embedded wallets, receipts, notifications, KYC, and treating `/api/*` DB writes as chain authority.
- Invariants you must not break:
  - Funds leave a treasury only through a valid proposal that meets its threshold.
  - Creator has no extra spending power after creation.
  - Membership and threshold are immutable in the MVP.
  - Proposal amount and recipient are immutable after create.
  - One approval per member; execute is one-shot; treasuries do not share balances.
  - Recipient need not be a member. Non-members cannot contribute, propose, or approve.
- Money is integer/`bigint` base units at the contract seam. `formatAmount` / `parseFloat` are display-only. Reject zero, negative, and malformed amounts before simulation.
- API JSON shape is `{ success, ... }` / `{ success: false, error }`. Do not accept `creatorAddress`, `approverAddress`, `executorAddress`, or `signature` in a request body as wallet authorization.
- UI should read as governed money, not generic Web3: calm fintech, tabular amounts, visible Testnet/demo status, and an approval rail that shows required vs current approvals before any sign.
- Separate generated Next/framework files from source in the PR description. Call out demo vs wallet-mode behavior and any residual Testnet risk.
