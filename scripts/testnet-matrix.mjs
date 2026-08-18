#!/usr/bin/env node
// Opt-in live Testnet readiness matrix runner.
//
// Non-public COHOLD_TESTNET_* secrets are required — the matrix proves the
// deployed contracts govern shared funds, so it must never run with blank,
// public, or fixture credentials. Contract/token IDs default to the public
// deployments/testnet.json manifest (ids are public; secrets stay in the
// environment or a private store) and can be overridden per run.
//
// Runs the isolation-negative suite; fails loudly when secrets are missing
// or the manifest is unusable. Not part of CI — the GitHub workflow
// (testnet-live.yml) is workflow_dispatch-only and never a required PR check.
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = join(ROOT, "deployments", "testnet.json");
const SUITE_PATH = join(ROOT, "src", "lib", "isolation-negative.testnet.test.ts");

export const REQUIRED_SECRETS = [
  "COHOLD_TESTNET_SECRET_A",
  "COHOLD_TESTNET_SECRET_B",
  "COHOLD_TESTNET_SECRET_C",
  "COHOLD_TESTNET_SECRET_D",
];

const CONTRACT_ID_RE = /^C[A-Z2-7]{55}$/;

/** Stellar secret key (seed) strkey: 'S' + 55 base32 chars. */
const SECRET_RE = /^S[A-Z2-7]{55}$/;

/**
 * Resolved live-matrix env:
 *   { contractIdA, contractIdB, tokenId, resolvedSecretCount }
 */

/** Resolve and validate the live-matrix environment (pure, unit-testable). */
export function resolveMatrixEnv(env, manifestPath = MANIFEST_PATH) {
  const errors = [];

  const missing = REQUIRED_SECRETS.filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    errors.push(
      `Missing non-public Testnet secrets: ${missing.join(", ")}. ` +
        "Export them (e.g. from the stellar CLI keyring via `stellar keys secret <identity>`) " +
        "before running the live matrix.",
    );
  }
  const malformed = REQUIRED_SECRETS.filter(
    (key) => env[key]?.trim() && !SECRET_RE.test(env[key].trim()),
  );
  if (malformed.length > 0) {
    errors.push(
      `Malformed Testnet secrets (must be S… 56-char Stellar secret keys): ${malformed.join(", ")}.`,
    );
  }

  let manifest = null;
  if (existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch {
      // Treat an unreadable manifest as absent; ids then must come from env.
    }
  }
  const treasury = (key) => manifest?.treasuries?.find((t) => t.key === key);

  const contractIdA = (env.COHOLD_TESTNET_CONTRACT_ID ?? treasury("A")?.id ?? "")
    .trim()
    .toUpperCase();
  const contractIdB = (env.COHOLD_TESTNET_CONTRACT_ID_B ?? treasury("B")?.id ?? "")
    .trim()
    .toUpperCase();
  const tokenId = (env.COHOLD_TESTNET_TOKEN_ID ?? manifest?.tokenId ?? "")
    .trim()
    .toUpperCase();

  if (!CONTRACT_ID_RE.test(contractIdA)) {
    errors.push(
      "Treasury A contract id is not a valid Soroban contract id (C…). " +
        "Set COHOLD_TESTNET_CONTRACT_ID or fix deployments/testnet.json.",
    );
  }
  if (!CONTRACT_ID_RE.test(contractIdB)) {
    errors.push(
      "Treasury B contract id is not a valid Soroban contract id (C…). " +
        "Set COHOLD_TESTNET_CONTRACT_ID_B or fix deployments/testnet.json.",
    );
  }
  if (!CONTRACT_ID_RE.test(tokenId)) {
    errors.push(
      "Token contract id is not a valid Soroban contract id (C…). " +
        "Set COHOLD_TESTNET_TOKEN_ID or fix deployments/testnet.json.",
    );
  }
  if (contractIdA && contractIdB && contractIdA === contractIdB) {
    errors.push("Treasury A and B must be different contracts (isolation requires two).");
  }

  const resolvedSecretCount = REQUIRED_SECRETS.length - missing.length;
  if (errors.length > 0) {
    return { ok: false, errors, env: null };
  }
  return {
    ok: true,
    errors: [],
    env: { contractIdA, contractIdB, tokenId, resolvedSecretCount },
  };
}

export function printPlan(resolution) {
  console.log("Cohold live Testnet readiness matrix");
  console.log("-------------------------------------");
  console.log(`Treasury A : ${resolution.contractIdA}`);
  console.log(`Treasury B : ${resolution.contractIdB}`);
  console.log(`Token      : ${resolution.tokenId}`);
  console.log(
    `Secrets    : ${resolution.resolvedSecretCount}/${REQUIRED_SECRETS.length} resolved`,
  );
  console.log("Scenarios  : outsider writes, duplicate approval, under-threshold");
  console.log("             execute, approved over-balance (stays Approved),");
  console.log("             wrong network, rejected signature, wallet cancel,");
  console.log("             competing proposals, permissionless execute,");
  console.log("             double execute, cross-treasury isolation.");
}

function main() {
  const resolution = resolveMatrixEnv(process.env);
  if (!resolution.ok || !resolution.env) {
    console.error("test:testnet refused to start:");
    for (const error of resolution.errors) console.error(`  - ${error}`);
    console.error(
      "The matrix must never run with blank or public credentials; nothing was executed.",
    );
    process.exitCode = 1;
    return;
  }

  printPlan(resolution.env);

  const vitestBin = join(ROOT, "node_modules", ".bin", "vitest");
  const result = spawnSync(vitestBin, ["run", SUITE_PATH], {
    stdio: "inherit",
    env: process.env,
  });
  process.exitCode = result.status ?? 1;
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();