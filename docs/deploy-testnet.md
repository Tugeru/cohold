# Testnet Treasury Bootstrap

One command deploys two initialized Testnet treasuries from the reviewed Cohold
Wasm, records a secret-free manifest, and prints the `NEXT_PUBLIC_*` values for
wallet mode.

> **Not the only path.** The app itself can create a treasury on Testnet from
> a connected Freighter wallet (Create Treasury on `/overview` — one
> signature via the CoholdFactory contract, which deploys and initializes
> the instance from the on-ledger Cohold Wasm). That registers the id
> locally without env edits, and the factory's on-chain treasury list makes
> it visible on every device. The bootstrap below is for scripted, canonical
> setups and power users.

## Prerequisites

- `stellar` CLI 27+ on `PATH` (`stellar --version`).
- Rust toolchain with the wasm target required by the installed stellar CLI —
  CLI 27+ builds to `wasm32v1-none`, older CLIs to `wasm32-unknown-unknown`;
  the bootstrap accepts either output path (the bootstrap runs `stellar
  contract build --package cohold`).
- Testnet reachability. The CLI ships a `testnet` network config
  (`https://soroban-testnet.stellar.org/`); the bootstrap verifies it and fails
  with a clear error if it is missing or unreachable.

## Identities

The bootstrap uses the stellar CLI keyring — identities live in
`~/.config/stellar/` (or `$XDG_CONFIG_HOME/stellar`), **never in the repo**.
Each identity is created with `stellar keys generate <name> --fund` on first
run; existing identities are reused so public keys stay stable across runs.

| Identity               | Role                                                            |
| ---------------------- | --------------------------------------------------------------- |
| `cohold-deployer`      | Pays deploy fees; source for read-only sanity calls             |
| `cohold-member-a`      | Member of treasury A; creator of A                          |
| `cohold-member-b`      | Member of treasuries A and B; creator of B                  |
| `cohold-member-c`      | Member of treasuries A and B                                    |
| `cohold-member-d`      | Member of treasuries A and B                                    |
| `cohold-recipient`     | Non-member recipient for execute scenarios (later slices)       |
| `cohold-outsider`      | Non-member for negative authorization tests (later slices)      |

Public keys are recorded in `deployments/testnet.json` after the first run and
can be shown any time with `stellar keys public-key <name>`. Secret keys never
leave the keyring and are never written to the repository.

## Run

```sh
npm run testnet:bootstrap
```

Sequence, in order: verify CLI and Testnet config → build the Wasm → hash it
(SHA-256) → resolve the native XLM SAC id → ensure identities (create + fund
missing ones) → deploy Contract A → initialize as **IT Society Event Fund**
(members A–D, threshold 3) → deploy Contract B → initialize as **Capstone
Project Fund** (members B–D, threshold 2) → read-only sanity on both instances
(`get_config`, `get_members`, `get_balance`) → write `deployments/testnet.json`
→ print the `NEXT_PUBLIC_*` values.

Sanity verifies on-chain facts: name, token id, threshold, member count,
creator, member list, and a zero opening balance. Any mismatch aborts with a
non-zero exit before the manifest is written.

## Output

`deployments/testnet.json` records `network`, `rpc`, `asset`, `tokenId`, `git
SHA`, `wasmSha256`, `timestamp`, both treasuries (contract id, name, creator,
members, threshold), the `factoryId` (CoholdFactory), and the identity public
keys. No secrets.

The script prints lines to paste into `.env`:

```
NEXT_PUBLIC_COHOLD_MODE=wallet
NEXT_PUBLIC_STELLAR_NETWORK=TESTNET
NEXT_PUBLIC_STELLAR_CONTRACT_ID=C…
NEXT_PUBLIC_STELLAR_CONTRACT_IDS=C…,C…
NEXT_PUBLIC_STELLAR_TOKEN_ID=CDLZ…
NEXT_PUBLIC_COHOLD_FACTORY_ID=C…
```

Treasury A is the primary `NEXT_PUBLIC_STELLAR_CONTRACT_ID`; both are listed in
`NEXT_PUBLIC_STELLAR_CONTRACT_IDS`.

## Re-runs and safety

The bootstrap refuses to overwrite an existing manifest: a second run fails
with an actionable error unless `--force` is passed.

- `--force` deploys two **fresh** instances, backs the previous manifest up to
  `deployments/archive/testnet.<timestamp>.json`, and overwrites
  `deployments/testnet.json`. Old contract instances become orphans — they can
  still hold funds and are no longer referenced by the app. Prefer a clean
  manifest restore over repeated force runs.

## Live acceptance matrix

`npm run test:testnet` proves on the deployed treasuries that the contract —
not the UI — governs shared funds: outsider writes (`NotMember`), duplicate
approval (`AlreadyApproved`), under-threshold execute
(`ThresholdNotReached`), approved over-balance execute (`InsufficientBalance`
leaving the proposal `Approved`), double execute (`AlreadyExecuted`),
competing proposals (only one solvent execution wins), wrong-network and
wrong-actor signatures rejected by Testnet RPC, wallet cancel, permissionless
execute by a non-member fee-payer, and cross-treasury isolation (treasury A
churn never moves treasury B and vice versa).

The runner reads the treasury/token ids from the public
`deployments/testnet.json` manifest and requires all four secret keys; it
never runs with blank or public credentials. Secrets are exported from the CLI
keyring — they never enter the repo:

```sh
export COHOLD_TESTNET_SECRET_A="$(stellar keys secret cohold-member-a)"
export COHOLD_TESTNET_SECRET_B="$(stellar keys secret cohold-member-b)"
export COHOLD_TESTNET_SECRET_C="$(stellar keys secret cohold-outsider)"
export COHOLD_TESTNET_SECRET_D="$(stellar keys secret cohold-member-d)"
npm run test:testnet
```

Per-contract deployment drift is detected: the suite asserts the live
`get_config`/`get_members` match the manifest before exercising any flow, so
an out-of-date manifest fails loudly instead of testing the wrong treasury.

The suite is rerun-safe (append-only proposals; treasury A refills to a target
balance each run and competing-proposal amounts derive from the measured
balance) and spends real Testnet XLM — keep the actor accounts funded
(`stellar keys fund <name>` tops up only accounts funded exactly once by
Friendbot; manual funding via Horizon is fine after that).

The live workflow (`.github/workflows/testnet-live.yml`) is
`workflow_dispatch`-only and is **not** a required public PR check. To run it
in Actions: create repository secrets named `COHOLD_TESTNET_SECRET_A` through
`COHOLD_TESTNET_SECRET_D` with the `stellar keys secret` output above, then
trigger the workflow from the Actions tab.

## Failure modes

- **Friendbot rate-limited or unreachable** during identity creation: retry;
  the error names the identity.
- **Identity exists but is unfunded** (aborted first run): fund it manually
  with `stellar keys fund <name>` and re-run; funding works once per account.
- **Build errors**: install the wasm target with
  `rustup target add wasm32-unknown-unknown` and ensure Cargo can resolve the
  workspace.
- **Network misconfiguration**: `stellar network add testnet --rpc-url
  https://soroban-testnet.stellar.org/ --network-passphrase "Test SDF Network ;
  September 2015"`.