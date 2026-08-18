/**
 * Gate for the live Testnet readiness matrix (npm run test:testnet).
 *
 * The suite must never execute — not even at collection time — unless every
 * required COHOLD_TESTNET_* secret is present and well-formed and the
 * treasury/token ids resolve to distinct, well-formed Soroban contract
 * addresses. Kept as a pure function so `npm test` can unit-test the gate
 * without touching the network or the keyring.
 */

export const REQUIRED_TESTNET_SECRETS = [
  "COHOLD_TESTNET_SECRET_A",
  "COHOLD_TESTNET_SECRET_B",
  "COHOLD_TESTNET_SECRET_C",
  "COHOLD_TESTNET_SECRET_D",
] as const;

export type RequiredTestnetSecret = (typeof REQUIRED_TESTNET_SECRETS)[number];

export const SOROBAN_CONTRACT_ID_RE = /^C[A-Z2-7]{55}$/;

/** Stellar secret key (seed) strkey: 'S' + 55 base32 chars. */
export const STELLAR_SECRET_RE = /^S[A-Z2-7]{55}$/;

export interface MatrixGateResult {
  enabled: boolean;
  /** Human-readable reasons the matrix must not run. */
  problems: string[];
}

export function resolveMatrixGate(
  env: Record<string, string | undefined>,
  ids: { contractIdA: string; contractIdB: string; tokenId: string },
): MatrixGateResult {
  const problems: string[] = [];

  for (const name of REQUIRED_TESTNET_SECRETS) {
    const value = (env[name] ?? "").trim();
    if (value.length === 0) {
      problems.push(`${name} is missing`);
    } else if (!STELLAR_SECRET_RE.test(value)) {
      problems.push(`${name} is not a valid Stellar secret key`);
    }
  }

  for (const [label, id] of [
    ["contractIdA", ids.contractIdA],
    ["contractIdB", ids.contractIdB],
    ["tokenId", ids.tokenId],
  ] as const) {
    if (!SOROBAN_CONTRACT_ID_RE.test(id)) {
      problems.push(`${label} is not a valid Soroban contract id`);
    }
  }

  if (ids.contractIdA === ids.contractIdB) {
    problems.push("contractIdA and contractIdB must be different treasuries");
  }

  return { enabled: problems.length === 0, problems };
}