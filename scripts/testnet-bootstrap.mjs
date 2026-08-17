#!/usr/bin/env node
// One-command Testnet treasury bootstrap: verifies the stellar CLI/Testnet,
// builds the reviewed Wasm, hashes it, resolves the native XLM SAC, deploys
// two independent Cohold treasuries, initializes them with fixed members and
// thresholds, records a secret-free manifest, and prints NEXT_PUBLIC_* values.
//
// Secrets never enter the repo: identities live in the stellar CLI keyring
// (~/.config/stellar), created with `stellar keys generate --fund` on first
// run. The manifest holds public keys and contract ids only.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NETWORK = "testnet";
const ASSET = "native";
const CONTRACT_ID_RE = /C[0-9A-Z]{55}/g;
const WASM_CANDIDATES = [
  // stellar CLI 27+ builds to the wasm32v1-none target; older CLIs used
  // wasm32-unknown-unknown. Accept either so the script survives CLI churn.
  join(ROOT, "target", "wasm32v1-none", "release", "cohold.wasm"),
  join(ROOT, "target", "wasm32-unknown-unknown", "release", "cohold.wasm"),
];
const MANIFEST_PATH = join(ROOT, "deployments", "testnet.json");
const MANIFEST_BACKUP_DIR = join(ROOT, "deployments", "archive");

/** CLI keyring identities. Public keys go in the manifest; secrets stay in the keyring. */
export const IDENTITIES = Object.freeze({
  deployer: "cohold-deployer",
  memberA: "cohold-member-a",
  memberB: "cohold-member-b",
  memberC: "cohold-member-c",
  memberD: "cohold-member-d",
  recipient: "cohold-recipient",
  outsider: "cohold-outsider",
});

/**
 * The two treasuries this bootstrap provisions. A and B are separate contract
 * instances from the same Wasm, with independent members and thresholds.
 * Creator must be a member (contract invariant); recipient/outsider are not.
 */
export const TREASURIES = Object.freeze([
  Object.freeze({
    key: "A",
    name: "IT Society Event Fund",
    creator: "memberA",
    members: ["memberA", "memberB", "memberC", "memberD"],
    threshold: 3,
  }),
  Object.freeze({
    key: "B",
    name: "Capstone Project Fund",
    creator: "memberB",
    members: ["memberB", "memberC", "memberD"],
    threshold: 2,
  }),
]);

/** Secret-free manifest recorded at deployments/testnet.json. */
export function buildManifest({
  rpc,
  tokenId,
  gitSha,
  wasmSha256,
  timestamp,
  identities,
  treasuries,
}) {
  return {
    network: NETWORK,
    rpc,
    asset: ASSET,
    tokenId,
    gitSha,
    wasmSha256,
    timestamp,
    identities,
    treasuries,
  };
}

function run(bin, args) {
  try {
    return execFileSync(bin, args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    const detail = err.stderr?.trim?.() || err.message;
    throw new Error(`\`${bin} ${args.join(" ")}\` failed: ${detail}`);
  }
}

function testnetRpcUrl() {
  const out = run("stellar", ["network", "ls", "--long"]);
  const lines = out.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() !== `Name: ${NETWORK}`) continue;
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j += 1) {
      const match = lines[j].match(/^RPC url:\s*(.+)$/);
      if (match) return match[1].trim();
    }
    throw new Error(
      `network "${NETWORK}" has no RPC url in \`stellar network ls --long\``,
    );
  }
  throw new Error(`network "${NETWORK}" not configured: \`stellar network ls --long\``);
}

function ensureIdentity(name) {
  const existing = run("stellar", ["keys", "ls"])
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (existing.includes(name)) return;
  console.log(`Creating identity ${name} and funding via Testnet friendbot...`);
  run("stellar", ["keys", "generate", name, "--fund"]);
}

function publicKey(name) {
  return run("stellar", ["keys", "public-key", name]).trim();
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function deploy(wasmPath) {
  const out = run("stellar", [
    "contract",
    "deploy",
    "--wasm",
    wasmPath,
    "--source-account",
    IDENTITIES.deployer,
    "--network",
    NETWORK,
  ]);
  const ids = out.match(CONTRACT_ID_RE);
  if (!ids) {
    throw new Error(`deploy returned no contract id:\n${out}`);
  }
  return ids.at(-1);
}

function initialize(spec, pub, contractId, tokenId) {
  const membersArg = JSON.stringify(spec.members.map((role) => pub[role]));
  run("stellar", [
    "contract",
    "invoke",
    "--id",
    contractId,
    "--source-account",
    IDENTITIES[spec.creator],
    "--network",
    NETWORK,
    "--",
    "initialize",
    "--creator",
    pub[spec.creator],
    "--token",
    tokenId,
    "--members",
    membersArg,
    "--threshold",
    String(spec.threshold),
    "--name",
    spec.name,
  ]);
}

/** View call: simulates, never submits (--send=no). */
function view(contractId, fn) {
  return run("stellar", [
    "contract",
    "invoke",
    "--id",
    contractId,
    "--source-account",
    IDENTITIES.deployer,
    "--network",
    NETWORK,
    "--send=no",
    "--",
    fn,
  ]);
}

/** Parse a JSON value out of CLI output that may carry log lines around it. */
export function parseJsonValue(stdout) {
  const text = stdout.trim();
  try {
    return JSON.parse(text);
  } catch {
    // Not the whole output: CLI log lines may precede/follow the value.
  }
  const first = text.search(/[[{]/);
  if (first < 0) {
    throw new Error(`no JSON value in output: ${text}`);
  }
  const candidate = text.slice(first);
  // The value is the longest JSON prefix; log lines may follow it.
  for (let end = candidate.length; end > first; end -= 1) {
    try {
      return JSON.parse(candidate.slice(0, end));
    } catch {
      // keep shrinking
    }
  }
  throw new Error(`unparseable JSON value in output: ${text}`);
}

function unwrapResult(value) {
  if (value && typeof value === "object" && "Ok" in value) return value.Ok;
  if (value && typeof value === "object" && "Err" in value) {
    throw new Error(`contract returned Err(${JSON.stringify(value.Err)})`);
  }
  return value;
}

function verifyTreasury(spec, pub, contractId, tokenId) {
  const config = unwrapResult(parseJsonValue(view(contractId, "get_config")));
  const members = parseJsonValue(view(contractId, "get_members"));
  const balance = parseJsonValue(view(contractId, "get_balance"));
  const expectedMembers = spec.members.map((role) => pub[role]).sort();
  const checks = {
    "config.name": config.name === spec.name,
    "config.token": config.token === tokenId,
    "config.threshold": config.threshold === spec.threshold,
    "config.member_count": config.member_count === spec.members.length,
    "config.creator": config.creator === pub[spec.creator],
    "get_members": JSON.stringify([...members].sort()) === JSON.stringify(expectedMembers),
    "get_balance": BigInt(balance) === 0n,
  };
  const failed = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);
  if (failed.length > 0) {
    throw new Error(
      `sanity failed for treasury ${spec.key} (${spec.name}): ${failed.join(", ")}`,
    );
  }
}

function usage() {
  console.log(
    `Usage: node scripts/testnet-bootstrap.mjs [--force]

Deploys and initializes two Testnet treasuries from the reviewed Cohold Wasm,
writes deployments/testnet.json (refuses to overwrite without --force), and
prints the NEXT_PUBLIC_* values for .env. See docs/deploy-testnet.md.`,
  );
}

function main() {
  const force = process.argv.includes("--force");

  if (existsSync(MANIFEST_PATH)) {
    if (!force) {
      throw new Error(
        `${MANIFEST_PATH} already exists. Treasuries are not re-deployed by ` +
          "accident: pass --force to deploy fresh instances and overwrite the " +
          "manifest (previous instances become orphans; a backup is kept).",
      );
    }
    const prev = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
    mkdirSync(MANIFEST_BACKUP_DIR, { recursive: true });
    const backup = join(
      MANIFEST_BACKUP_DIR,
      `testnet.${prev.timestamp.replace(/[:.]/g, "-")}.json`,
    );
    copyFileSync(MANIFEST_PATH, backup);
    console.log(`Backing up existing manifest to ${backup}`);
  }

  run("stellar", ["--version"]);
  const rpc = testnetRpcUrl();
  console.log(`Stellar CLI and ${NETWORK} verified (RPC ${rpc}).`);

  console.log("Building reviewed Cohold Wasm...");
  run("stellar", ["contract", "build", "--package", "cohold"]);
  const wasmPath = WASM_CANDIDATES.find((path) => existsSync(path));
  if (!wasmPath) {
    throw new Error(
      `expected built Wasm at one of: ${WASM_CANDIDATES.join(", ")}`,
    );
  }
  const wasmSha256 = sha256File(wasmPath);
  const gitSha = run("git", ["rev-parse", "HEAD"]).trim();

  console.log("Ensuring identities (created+funded on first run)...");
  for (const name of Object.values(IDENTITIES)) ensureIdentity(name);
  const pub = Object.fromEntries(
    Object.entries(IDENTITIES).map(([role, name]) => [role, publicKey(name)]),
  );

  console.log("Resolving native XLM SAC...");
  const tokenId = run("stellar", [
    "contract",
    "id",
    "asset",
    "--asset",
    ASSET,
    "--network",
    NETWORK,
  ]).trim();

  const treasuries = [];
  for (const spec of TREASURIES) {
    console.log(`Deploying treasury ${spec.key} (${spec.name})...`);
    const contractId = deploy(wasmPath);
    console.log(`  contract ${contractId}`);
    console.log(`Initializing ${spec.key}...`);
    initialize(spec, pub, contractId, tokenId);
    verifyTreasury(spec, pub, contractId, tokenId);
    console.log(`  sanity ok (config, members, balance).`);
    treasuries.push({
      key: spec.key,
      name: spec.name,
      id: contractId,
      creator: pub[spec.creator],
      members: spec.members.map((role) => pub[role]),
      threshold: spec.threshold,
    });
  }

  const manifest = buildManifest({
    rpc,
    tokenId,
    gitSha,
    wasmSha256,
    timestamp: new Date().toISOString(),
    identities: pub,
    treasuries,
  });
  mkdirSync(dirname(MANIFEST_PATH), { recursive: true });
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Manifest written to ${MANIFEST_PATH}.`);

  const primary = treasuries.find((t) => t.key === "A").id;
  const extras = treasuries.map((t) => t.id).join(",");
  console.log("");
  console.log("Add to .env for wallet mode:");
  console.log("NEXT_PUBLIC_COHOLD_MODE=wallet");
  console.log("NEXT_PUBLIC_STELLAR_NETWORK=TESTNET");
  console.log(`NEXT_PUBLIC_STELLAR_CONTRACT_ID=${primary}`);
  console.log(`NEXT_PUBLIC_STELLAR_CONTRACT_IDS=${extras}`);
  console.log(`NEXT_PUBLIC_STELLAR_TOKEN_ID=${tokenId}`);
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    if (process.argv.includes("--help") || process.argv.includes("-h")) {
      usage();
    } else {
      main();
    }
  } catch (err) {
    console.error(`bootstrap failed: ${err.message}`);
    process.exit(1);
  }
}