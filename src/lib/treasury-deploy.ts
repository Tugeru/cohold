import * as StellarSdk from "@stellar/stellar-sdk";
import { contract } from "@stellar/stellar-sdk";
import { Client as FactoryClient } from "cohold-factory-contract";
import {
  STELLAR_TESTNET_NETWORK_PASSPHRASE,
  STELLAR_TESTNET_RPC_URL,
  isValidContractAddress,
  isValidStellarAddress,
} from "@/lib/stellar";
import type { WalletSignatureResult } from "@/lib/wallet-adapter";
import { signatureError, simulationErrorOf } from "@/lib/proposal-flow";
import type { ProposalError } from "@/lib/proposal-flow";

// ---------------------------------------------------------------------------
// Create a treasury on Testnet from the browser. Creation is one signed
// transaction: the CoholdFactory contract deploys a fresh Cohold instance
// from the uploaded Cohold Wasm (hash passed as an argument) and initializes
// it with members, threshold, and name in the same call. The simulation
// gathers the creator's authorization for both the factory call and the
// nested initialize, so Freighter asks for exactly one signature. After the
// transaction confirms, the flow registers the new contract id locally so
// the app renders it immediately; the factory's on-chain treasury list makes
// it discoverable on every other device.
//
// The Cohold Wasm must already be installed on the ledger — the Testnet
// bootstrap deploys treasuries from it, which uploads the code. The app
// passes the Wasm's sha256 (computed from the bundled public/cohold.wasm) as
// `wasm_hash`; creation fails if that hash is not on-chain.
// ---------------------------------------------------------------------------

export type TreasuryDeployStageName = "create";

export type TreasuryTxState =
  | "preparing"
  | "awaiting-signature"
  | "submitting"
  | "confirming";

export interface TreasuryDeployDetails {
  name: string;
  members: string[];
  threshold: number;
}

export type TreasuryDeployOutcome =
  | {
      status: "deployed";
      contractId: string;
      hash: string;
    }
  | { status: "validation"; message: string }
  | { status: "wasm-unavailable"; message: string }
  | { status: "simulation-failed"; stage: TreasuryDeployStageName; message: string }
  | { status: "sign-failed"; stage: TreasuryDeployStageName; error: ProposalError }
  | {
      status: "send-failed";
      stage: TreasuryDeployStageName;
      error: { message: string; hash?: string | null };
    }
  | { status: "confirm-failed"; stage: TreasuryDeployStageName; message: string };

export interface TreasuryDeployExecutor {
  createTreasury(
    params: {
      wasmHash: string;
      creator: string;
      tokenId: string;
      members: string[];
      threshold: number;
      name: string;
    },
    publicKey: string,
  ): Promise<{ preparedTxXdr: string; contractId: string }>;
  submitInvocation(signedTxXdr: string): Promise<{ hash: string }>;
  confirmInvocation(hash: string): Promise<"success" | "failed" | "pending">;
}

export interface TreasuryDeployFlowDeps {
  executor: TreasuryDeployExecutor;
  fetchWasm: () => Promise<Uint8Array>;
  signTransaction: (transactionXdr: string) => Promise<WalletSignatureResult>;
  registerTreasury: (registration: { id: string; name: string }) => void;
}

export interface TreasuryDeployFlow {
  deploy(
    details: TreasuryDeployDetails,
    creatorAddress: string,
    tokenId: string,
    onStage?: (stage: TreasuryDeployStageName, state: TreasuryTxState) => void,
  ): Promise<TreasuryDeployOutcome>;
}

/**
 * Normalizes name and member addresses. Returns a user-facing validation
 * message, or null when the details are deployable.
 */
export function validateTreasuryDetails(
  details: TreasuryDeployDetails,
  creatorAddress: string | null,
): string | null {
  const name = details.name.trim();
  if (name.length === 0) return "Give the treasury a name.";
  if (name.length > 60) return "Keep the name under 60 characters.";

  const creator = creatorAddress?.trim().toUpperCase() ?? null;
  if (!creator) return "Connect Freighter before creating a treasury.";

  const members = details.members.map((member) => member.trim().toUpperCase());
  if (members.length === 0) return "Add at least one member.";
  if (members.some((member) => !isValidStellarAddress(member))) {
    return "Every member needs a valid Stellar address.";
  }
  if (new Set(members).size !== members.length) {
    return "Remove duplicate member addresses.";
  }
  if (!members.includes(creator)) {
    return "You must be a member of a treasury you create — your wallet is locked in the member list.";
  }
  if (
    !Number.isInteger(details.threshold) ||
    details.threshold < 1 ||
    details.threshold > members.length
  ) {
    return `Approvals needed must be between 1 and ${members.length}.`;
  }
  return null;
}

export function normalizeTreasuryDetails(
  details: TreasuryDeployDetails,
): { name: string; members: string[]; threshold: number } {
  return {
    name: details.name.trim(),
    members: details.members.map((member) => member.trim().toUpperCase()),
    threshold: details.threshold,
  };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes as unknown as BufferSource,
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

type StageOk = { status: "ok"; hash: string; contractId?: string };
type StageFail = Exclude<
  TreasuryDeployOutcome,
  { status: "deployed" } | { status: "validation" } | { status: "wasm-unavailable" }
>;

export function createTreasuryDeployFlow(deps: TreasuryDeployFlowDeps): TreasuryDeployFlow {
  const { executor, fetchWasm, signTransaction, registerTreasury } = deps;

  async function runStage(
    onStage: ((stage: TreasuryDeployStageName, state: TreasuryTxState) => void) | undefined,
    prepare: () => Promise<{ preparedTxXdr: string; contractId?: string }>,
  ): Promise<StageOk | StageFail> {
    onStage?.("create", "preparing");
    let prepared: { preparedTxXdr: string; contractId?: string };
    try {
      prepared = await prepare();
    } catch (error) {
      return {
        status: "simulation-failed",
        stage: "create",
        message: error instanceof Error ? error.message : String(error),
      };
    }
    onStage?.("create", "awaiting-signature");
    const signature = await signTransaction(prepared.preparedTxXdr);
    if (signature.status !== "signed") {
      return { status: "sign-failed", stage: "create", error: signatureError(signature) };
    }
    onStage?.("create", "submitting");
    let hash: string;
    try {
      hash = (await executor.submitInvocation(signature.signedTxXdr)).hash;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      let errorHash: string | null = null;
      if (typeof error === "object" && error !== null && "hash" in error) {
        const candidate: unknown = error.hash;
        if (typeof candidate === "string" && candidate.length > 0) errorHash = candidate;
      }
      return { status: "send-failed", stage: "create", error: { message, hash: errorHash } };
    }
    onStage?.("create", "confirming");
    const confirmed = await executor.confirmInvocation(hash);
    if (confirmed === "success") {
      return { status: "ok", hash, contractId: prepared.contractId };
    }
    if (confirmed === "failed") {
      return {
        status: "confirm-failed",
        stage: "create",
        message: "The network rejected the transaction — nothing was created.",
      };
    }
    return {
      status: "confirm-failed",
      stage: "create",
      message: "Confirmation timed out. Check the treasury list before trying again.",
    };
  }

  async function deploy(
    details: TreasuryDeployDetails,
    creatorAddress: string,
    tokenId: string,
    onStage?: (stage: TreasuryDeployStageName, state: TreasuryTxState) => void,
  ): Promise<TreasuryDeployOutcome> {
    const creator = creatorAddress?.trim().toUpperCase();
    const validation = validateTreasuryDetails(details, creator);
    if (validation) return { status: "validation", message: validation };
    if (!creator) {
      return { status: "validation", message: "Connect Freighter before creating a treasury." };
    }

    let wasm: Uint8Array;
    try {
      wasm = await fetchWasm();
    } catch (error) {
      return {
        status: "wasm-unavailable",
        message:
          error instanceof Error
            ? `Contract code could not be loaded (${error.message}).`
            : "Contract code could not be loaded.",
      };
    }
    const wasmHash = await sha256Hex(wasm);
    const normalized = normalizeTreasuryDetails(details);

    const created = await runStage(onStage, () =>
      executor.createTreasury(
        {
          wasmHash,
          creator,
          tokenId,
          members: normalized.members,
          threshold: normalized.threshold,
          name: normalized.name,
        },
        creator,
      ),
    );
    if (created.status !== "ok") return created;
    if (!created.contractId) {
      return {
        status: "simulation-failed",
        stage: "create",
        message: "Creation did not return a contract id.",
      };
    }

    registerTreasury({ id: created.contractId, name: normalized.name });
    return {
      status: "deployed",
      contractId: created.contractId,
      hash: created.hash,
    };
  }

  return { deploy };
}

// ---------------------------------------------------------------------------
// Stellar SDK implementation. Simulation happens before any signing; the
// wallet is never asked to sign a transaction that failed simulation.
// ---------------------------------------------------------------------------

export interface TreasuryDeployExecutorOptions {
  rpcUrl?: string;
  networkPassphrase?: string;
  /** CoholdFactory contract id. Required: creation goes through the factory. */
  factoryId?: string | null;
}

export function stellarTreasuryDeployExecutor(
  options: TreasuryDeployExecutorOptions = {},
): TreasuryDeployExecutor {
  const rpcUrl = options.rpcUrl ?? STELLAR_TESTNET_RPC_URL;
  const networkPassphrase =
    options.networkPassphrase ?? STELLAR_TESTNET_NETWORK_PASSPHRASE;
  const factoryId = options.factoryId?.trim().toUpperCase() ?? null;
  if (!factoryId || !isValidContractAddress(factoryId)) {
    throw new Error(
      "The Cohold factory is not configured (NEXT_PUBLIC_COHOLD_FACTORY_ID).",
    );
  }
  // Narrowed copy: the guard's narrowing does not survive into closures.
  const configuredFactoryId = factoryId;
  const server = new StellarSdk.rpc.Server(rpcUrl);

  async function createTreasury(
    params: {
      wasmHash: string;
      creator: string;
      tokenId: string;
      members: string[];
      threshold: number;
      name: string;
    },
    publicKey: string,
  ) {
    const client = new FactoryClient({
      contractId: configuredFactoryId,
      rpcUrl,
      networkPassphrase,
      publicKey,
    });
    const tx = await client.create({
      wasm_hash: Buffer.from(params.wasmHash, "hex"),
      creator: params.creator,
      token: params.tokenId,
      members: params.members,
      threshold: params.threshold,
      name: params.name,
    });
    const rejected = simulationErrorOf(tx);
    if (rejected) throw rejected;
    let contractId: string;
    try {
      const result = tx.result as unknown as { unwrap: () => string };
      contractId = result.unwrap();
    } catch {
      throw new Error("Creation did not return a contract id.");
    }
    if (!isValidContractAddress(contractId)) {
      throw new Error("Creation returned an unexpected contract id.");
    }
    return { preparedTxXdr: tx.toXDR(), contractId };
  }

  async function submitInvocation(signedTxXdr: string) {
    const transaction = StellarSdk.TransactionBuilder.fromXDR(
      signedTxXdr,
      networkPassphrase,
    );
    const response = await server.sendTransaction(transaction);
    if (response.status === "ERROR") {
      throw Object.assign(
        new Error(
          "Testnet rejected the transaction — check its status before retrying.",
        ),
        { hash: response.hash },
      );
    }
    return { hash: response.hash };
  }

  async function confirmInvocation(hash: string) {
    const response = await server.pollTransaction(hash, {
      attempts: 30,
      sleepStrategy: (attempt) => Math.min(2_000, 500 * attempt),
    });
    if (response.status === "SUCCESS") return "success";
    if (response.status === "FAILED") return "failed";
    return "pending";
  }

  return { createTreasury, submitInvocation, confirmInvocation };
}
