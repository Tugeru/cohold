# Cohold — Testnet MVP Acceptance Evidence

**Product:** Cohold (shared treasury with multi-approval spending)
**Target Network:** Stellar Testnet
**Evidence captures:** 2026-08-18 (walkthrough + isolation/negatives matrix)
**Related:** `cohold-mvp-readiness-guide.md`, `cohold-srs.md`, `deploy-testnet.md`,
`deployments/testnet.json`, `deployments/walkthrough.json`

This document is the audit record for the Testnet MVP. Every claim below maps
to a reproducible artifact: the deployment manifest, the live walkthrough
evidence file, the live isolation/negatives suite, or CI runs. A bare `PASS`
is never evidence here — the hashes, balances, and rejections are recorded.

## 1. Reproducing this evidence

All live commands are opt-in (they spend real Testnet XLM) and skip
themselves unless the `COHOLD_TESTNET_SECRET_*` keys are exported from the
stellar CLI keyring. Secrets never enter the repo.

```sh
# 1. Deployment manifest (git SHA, Wasm hash, ids, members, thresholds):
cat deployments/testnet.json

# 2. Canonical walkthrough → rewrites deployments/walkthrough.json:
export COHOLD_TESTNET_SECRET_A="$(stellar keys secret cohold-member-a)"
export COHOLD_TESTNET_SECRET_B="$(stellar keys secret cohold-member-b)"
export COHOLD_TESTNET_SECRET_C="$(stellar keys secret cohold-outsider)"
export COHOLD_TESTNET_SECRET_D="$(stellar keys secret cohold-member-d)"
npm run test:walkthrough

# 3. Isolation and negatives matrix (both treasuries):
npm run test:testnet
```

`deployments/walkthrough.json` records the exact evidence of the latest
accepted run; diff any re-run against it. Runbook §3.2–§3.6 documents the
setup.

## 2. Deployment facts

Recorded at deploy time by `npm run testnet:bootstrap` in
`deployments/testnet.json`; the live suites assert on-chain config matches
this manifest before exercising any flow (drift fails loudly).

| Fact | Value |
|---|---|
| Network | `testnet` (`https://soroban-testnet.stellar.org/`) |
| Asset | native XLM via its SAC |
| Deploy git SHA | `a3ac5612fae5068938179574471afec8940785c5` |
| Wasm SHA-256 | `aa33eea8aa948a1b9043d0fcfa86fc057f1d649abab45fccc8bd070e63ff7616` |
| Token contract | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Treasury A | `CCYKPLZE4OT7LIBUPWRQ4UGARQTOVBORYLV3ZQIKSKVI77Z5JVV3CVR2` |
| Treasury B | `CABEVCDWFZ2W4W3H75T3DIOTEGHAVEPM2KETRROZNVHT2OVGUV4UVCYZ` |

Evidence capture commits: walkthrough run at `614a5e6` (this slice's
stabilized walkthrough test); isolation/negatives matrix run at `911a275`
(matrix suite unchanged through this slice).

One deployed contract instance = one treasury. Treasury A and treasury B are
separate instances of the same Wasm with independent members, thresholds, and
balances; isolation between them is asserted live (section 5).

### 2.1 Treasuries, members, thresholds

| | Treasury A | Treasury B |
|---|---|---|
| Name | IT Society Event Fund | Capstone Project Fund |
| Contract | `CCYKPL…CVR2` | `CABEV…UVCYZ` |
| Creator | member A | member B |
| Members | A, B, C, D (4) | B, C, D (3) |
| Threshold | 3 of 4 | 2 of 3 |

Public keys (from `deployments/testnet.json`, secrets stay in the CLI
keyring):

| Identity | Address |
|---|---|
| member A | `GCDL3PHABKF5ZHG7ZO7UEP25GPNBGMVWRYQSGRWNDI2ZAKMNHNFGBYB7` |
| member B | `GAZWTJVFLORJOH74AB2ZWNODQKLKHG6OVME73CC3GBL4P6BZYRKLJX52` |
| member C | `GDBDCCY6MMQGWDRZEXBDEUVESAUO2GQ7FZ3A66BJ2KS6MFSNDIHIRIG4` |
| member D | `GDFY5PMGT54AQRZUD4YUHYX2WBPBQHHZ47ZQVO47HK3SED4WZX5NP333` |
| recipient (non-member) | `GAGDZEKVL4TATSYQMQIK7T3OSGQ2KUC7SSV2HGVSSGFBXPOVDZUXVS5A` |
| outsider (non-member) | `GDXAANEJ4QDYG2YIL65YMRO4BBN2EZKSMOQX5Y26WOWVGVBO7LAFQUQI` |

## 3. Canonical Freighter walkthrough

The canonical acceptance run: **connect → fund → propose → 2/3 reject
execute → 3/3 execute → verify → reject double execute**. The on-chain steps
are driven through the exact flow modules the UI uses
(`contribute-flow`, `proposal-flow`) by
`src/lib/mvp-walkthrough.testnet.test.ts`, which records every hash and
balance to `deployments/walkthrough.json` (rewritten at
`2026-08-18T02:02:43.923Z`, captured at commit `614a5e6`). The Freighter
steps below are the browser-side form of the same sequence.

| # | Step | Wallet | Result | Evidence |
|---|---|---|---|---|
| 1 | Connect Freighter on Testnet; verify the network badge | member A | connected | manual (wrong network blocks actions — matrix §5) |
| 2 | Fund the treasury with 2.5000000 XLM | member A | confirmed; balance 9.5000000 → 12.0000000 XLM | `b6880aef04f7e77a3c1527fa4dbbd2b97a594a0e68c351c8dad7913e7cdae053` |
| 3 | Create proposal #34: 2.5000000 XLM → recipient | member A | confirmed; `approval_count = 1` (creation is the proposer's approval), status `pending`, progress 1/3 | `de514744a8e6dcf7a4d3b572355b667f30ed96e87c1c773060e2cdb356b8d1e7` |
| 4 | Approve | member B | confirmed; 2/3, still `pending` | `d41a971b871e7e25b6d591184a3d154f935dc13fc1db7b84c9a634a9233bce1d` |
| 5 | Attempt execute at 2/3 | member D | **rejected** `ThresholdNotReached` (contract #7); proposal `pending`, balances unchanged | walkthrough.json step `execute` #1 |
| 6 | Approve | member D | confirmed; 3/3 → `approved` | `b46e8933f09d2b12709e35131960aac5cc640bb531f60f878ee73dd2aacae710` |
| 7 | Execute | member D (permissionless) | confirmed; treasury 12.0000000 → 9.5000000 XLM; recipient 10087.0000000 → 10089.5000000 XLM (exact +2.5000000) | `eae760007d471d8440eeb457d680d06ca83247dcc515a9ec9d9f7bbbfe7de4f5` |
| 8 | Attempt execute again | member D | **rejected** `AlreadyExecuted` (contract #11); balances unchanged | walkthrough.json step `execute` #2 |

Recipient balance before the walkthrough: 10087.0000000 XLM; after:
10089.5000000 XLM. Proposal #34 terms are immutable on-chain: amount
2.5000000 XLM, recipient (non-member) — re-read from the contract after
each step.

Browser mapping for the manual walkthrough (wallet mode, `npm run dev`):

1. Open `/` → **Connect Wallet** → Freighter permission dialog → network
   badge shows Testnet.
2. Open `/treasuries` → treasury A → **Add Funds** → review → sign.
3. **Create Proposal** (amount, recipient) → review → sign → the proposal
   row already shows the proposer's approval and progress 1 of 3.
4. Open the proposal → **Approve** → sign.
5. **Execute** on a 2/3 proposal → blocked (`ThresholdNotReached` error
   surfaced in plain language).
6. Second member approves → progress 3 of 3 → **Ready to Execute**.
7. **Execute** → confirm the exact treasury/amount/recipient → sign → wait
   for confirmation (signing is not success).
8. **Execute** again → blocked (`Already executed`).

## 4. Walkthrough before/after balances

All amounts in XLM (native, 7 decimals), base units in
`deployments/walkthrough.json`.

| Balance | Before | After |
|---|---|---|
| Treasury A | 9.5000000 (funded to 12.0000000) | 9.5000000 |
| Recipient (non-member) | 10087.0000000 | 10089.5000000 |

Contribution `2.5000000` XLM brings the treasury to `12.0000000`;
execute debits exactly `2.5000000` from treasury A and credits exactly
`2.5000000` to the recipient.

## 5. Isolation and negatives matrix

`src/lib/isolation-negative.testnet.test.ts` (run via `npm run test:testnet`)
passed **2/2 live scenarios** on 2026-08-18 (103 s), driving the UI flow
modules and re-reading contract state as source of truth. It also asserts
the live config matches the manifest before every scenario.

| Negative / invariant | Proof |
|---|---|
| Outsider writes rejected | `NotMember` (contract #3), treasury A |
| Duplicate approval rejected | `AlreadyApproved` (contract #8) |
| Under-threshold execute rejected | `ThresholdNotReached` (contract #7) at 2/3 |
| Approved over-balance execute rejected, proposal stays `Approved` | `InsufficientBalance` (contract #12); balance and terms unchanged |
| Double execute rejected | `AlreadyExecuted` (contract #11) |
| Competing proposals: only the first solvent execution wins | second stays `Approved` over-balance |
| Wrong-network signature rejected by RPC | Mainnet-passphrase signature → send-failed, state unchanged |
| Wrong-actor signature rejected | Malformed envelope → send-failed, state unchanged |
| Wallet cancel rejected before submission | cancelled signer → nothing submitted, state unchanged |
| Permissionless execute by non-member fee-payer | treasury B executed by outsider; amount/recipient/approvals immutable |
| Cross-treasury isolation | treasury A churn never moves treasury B and vice versa (balances, proposal counts, statuses) |
| One approval per member | proposer duplicate approve → `AlreadyApproved`; `has_approved` reads true |

Walkthrough-specific rejections (section 3): `ThresholdNotReached` at 2/3
(canonical step 5) and `AlreadyExecuted` (canonical step 8).

## 6. CI results

Automated gates run in `.github/workflows/ci.yml` on every push and PR:
`npm run lint`, `npm run typecheck`, `npm test`, `npm run build` (build is
deliberately not part of `npm run verify` — it rewrites `.next` and breaks
dev-server HMR inside long-lived agent sessions; run it explicitly for
substantial changes or rely on CI).

| Run | Workflow | Result |
|---|---|---|
| CI PR #36 slice/25 `94dc96b` (this slice) | CI | success (1m54s) — Contract tests + Quality checks |
| CI push `main` `911a275` (isolation + negatives matrix commit) | CI | success (2m1s) |
| CI PR slice/24 isolation + negatives | CI | success (1m53s) |
| CI push `main` 8815c8a (execute reviews + testnet execution coverage) | CI | success (1m53s) |
| CI PR slice/23 execute payment | CI | success (1m32s) |
| CI push `main` 1fb1110 (proposal create + approve on Testnet) | CI | success (1m49s) |
| CI PR slice/22 create + approve | CI | success (1m51s) |
| CI push `main` 614852d (fail-closed wallet diagnostics) | CI | success (1m52s) |

Live Testnet runs are **not** CI checks by design: `.github/workflows/
testnet-live.yml` is `workflow_dispatch`-only with repository secrets and is
never a required public PR check (AGENTS.md: live Testnet acceptance is a
manual/protected workflow). The equivalents ran locally for this record
(sections 3–5).

## 7. Readiness criteria cross-check

The readiness guide checklist (section 18) maps to the evidence above:

- **Wallet & identity** — Freighter flow (section 3); wrong network and
  rejected-signature negatives (section 5).
- **Treasury** — two configured instances open in wallet mode (section 2);
  members/thresholds read from chain, asserted against the manifest (sections
  2.1, 5); creator is a member with no unilateral spending power (contract
  invariant; Treasury B creator is not member of A).
- **Funds** — contribution confirmed with hash and balance delta (section 3);
  no individual withdrawal path exists in the contract.
- **Proposals** — create records approval #1 and immutable terms (section 3);
  non-member create/approve rejected (section 5).
- **Approvals** — one per member, duplicates and non-members rejected;
  progress 1/3 → 2/3 → 3/3 transition verified on-chain (sections 3, 5).
- **Execution** — under-threshold, over-balance, and double execute all
  rejected with balances held; exact amount reaches exact recipient
  (sections 3–5); cross-treasury spending impossible (section 5).
- **UX** — signing and confirmation are separate states; errors surface in
  plain language; Testnet status visible (runbook §3, readiness guide §13–14).