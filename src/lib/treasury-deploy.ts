import * as StellarSdk from "@stellar/stellar-sdk";
import { contract } from "@stellar/stellar-sdk";
import { Client } from "cohold-contract";
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
// Create a treasury on Testnet from the browser. Deploying a treasury is
// three signed transactions, in order: upload the contract Wasm, create the
// contract instance from that Wasm, then initialize it with members,
// threshold, and name. Every transaction is simulated before the wallet is
// asked to sign; the connected Freighter account pays the fees and is the
// contract creator. The contract enforces that the creator is a member, so
// validation requires the connected wallet in the member list. After
// initialize confirms, the flow registers the new contract id locally so the
// app renders it without an env edit or restart.
// ---------------------------------------------------------------------------

export type TreasuryDeployStageName = "upload" | "create" | "initialize";

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
      hashes: { upload: string; create: string; initialize: string };
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
  uploadWasm(
    wasm: Uint8Array,
    publicKey: string,
  ): Promise<{ preparedTxXdr: string }>;
  createContract(
    wasmHash: string,
    publicKey: string,
  ): Promise<{ preparedTxXdr: string; contractId: string }>;
  initializeTreasury(
    params: {
      contractId: string;
      creator: string;
      tokenId: string;
      members: string[];
      threshold: number;
      name: string;
    },
    publicKey: string,
  ): Promise<{ preparedTxXdr: string }>;
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
    stage: TreasuryDeployStageName,
    onStage: ((stage: TreasuryDeployStageName, state: TreasuryTxState) => void) | undefined,
    prepare: () => Promise<{ preparedTxXdr: string; contractId?: string }>,
  ): Promise<StageOk | StageFail> {
    onStage?.(stage, "preparing");
    let prepared: { preparedTxXdr: string; contractId?: string };
    try {
      prepared = await prepare();
    } catch (error) {
      return {
        status: "simulation-failed",
        stage,
        message: error instanceof Error ? error.message : String(error),
      };
    }
    onStage?.(stage, "awaiting-signature");
    const signature = await signTransaction(prepared.preparedTxXdr);
    if (signature.status !== "signed") {
      return { status: "sign-failed", stage, error: signatureError(signature) };
    }
    onStage?.(stage, "submitting");
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
      return { status: "send-failed", stage, error: { message, hash: errorHash } };
    }
    onStage?.(stage, "confirming");
    const confirmed = await executor.confirmInvocation(hash);
    if (confirmed === "success") {
      return { status: "ok", hash, contractId: prepared.contractId };
    }
    if (confirmed === "failed") {
      return {
        status: "confirm-failed",
        stage,
        message: "The network rejected the transaction — nothing was created.",
      };
    }
    return {
      status: "confirm-failed",
      stage,
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

    const upload = await runStage("upload", onStage, () =>
      executor.uploadWasm(wasm, creator),
    );
    if (upload.status !== "ok") return upload;

    const create = await runStage("create", onStage, () =>
      executor.createContract(wasmHash, creator),
    );
    if (create.status !== "ok") return create;
    if (!create.contractId) {
      return {
        status: "simulation-failed",
        stage: "create",
        message: "Deployment did not return a contract id.",
      };
    }

    const initialize = await runStage("initialize", onStage, () =>
      executor.initializeTreasury(
        {
          contractId: create.contractId!,
          creator,
          tokenId,
          members: normalized.members,
          threshold: normalized.threshold,
          name: normalized.name,
        },
        creator,
      ),
    );
    if (initialize.status !== "ok") return initialize;

    registerTreasury({ id: create.contractId, name: normalized.name });
    return {
      status: "deployed",
      contractId: create.contractId,
      hashes: { upload: upload.hash, create: create.hash, initialize: initialize.hash },
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
}

export function stellarTreasuryDeployExecutor(
  options: TreasuryDeployExecutorOptions = {},
): TreasuryDeployExecutor {
  const rpcUrl = options.rpcUrl ?? STELLAR_TESTNET_RPC_URL;
  const networkPassphrase =
    options.networkPassphrase ?? STELLAR_TESTNET_NETWORK_PASSPHRASE;
  const server = new StellarSdk.rpc.Server(rpcUrl);

  async function uploadWasm(wasm: Uint8Array, publicKey: string) {
    const tx = await contract.AssembledTransaction.buildWithOp(
      StellarSdk.Operation.uploadContractWasm({ wasm }),
      {
        rpcUrl,
        networkPassphrase,
        publicKey,
        contractId: "ignored",
        method: "upload_contract_wasm",
        parseResultXdr: (result) => result,
        simulate: true,
      },
    );
    const rejected = simulationErrorOf(tx);
    if (rejected) throw rejected;
    return { preparedTxXdr: tx.toXDR() };
  }

  async function createContract(wasmHash: string, publicKey: string) {
    // Deploy a fresh instance: contract id is derived from the deployer
    // address, a random salt, and the wasm hash. `Client.deploy` fetches the
    // spec from the uploaded wasm and returns a client bound to the new id.
    // The Cohold wasm has no `#[constructor]`, so constructor args must be
    // `null`: any truthy object (e.g. `{}`) makes the SDK look up
    // `__constructor` in the spec and throw "no such entry: __constructor"
    // before a transaction is ever built.
    const tx = await contract.Client.deploy(
      null,
      {
        wasmHash,
        address: publicKey,
        rpcUrl,
        networkPassphrase,
        publicKey,
        simulate: true,
      },
    );
    const rejected = simulationErrorOf(tx);
    if (rejected) throw rejected;
    const deployed = tx.result as unknown as { options: { contractId: string } };
    const contractId = deployed.options.contractId;
    if (!isValidContractAddress(contractId)) {
      throw new Error("Deployment returned an unexpected contract id.");
    }
    return { preparedTxXdr: tx.toXDR(), contractId };
  }

  async function initializeTreasury(
    params: {
      contractId: string;
      creator: string;
      tokenId: string;
      members: string[];
      threshold: number;
      name: string;
    },
    publicKey: string,
  ) {
    const client = new Client({
      contractId: params.contractId,
      rpcUrl,
      networkPassphrase,
      // The invoker is the wallet creator; their sequence/account drives the
      // simulation and their envelope signature authorizes `require_auth`.
      publicKey,
    });
    const tx = await client.initialize({
      creator: params.creator,
      token: params.tokenId,
      members: params.members,
      threshold: params.threshold,
      name: params.name,
    });
    const rejected = simulationErrorOf(tx);
    if (rejected) throw rejected;
    return { preparedTxXdr: tx.toXDR() };
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

  return { uploadWasm, createContract, initializeTreasury, submitInvocation, confirmInvocation };
}
