import * as StellarSdk from "@stellar/stellar-sdk";
import { contract } from "@stellar/stellar-sdk";
import { parseBaseUnits } from "@/lib/money";
import {
  STELLAR_TESTNET_NETWORK_PASSPHRASE,
  STELLAR_TESTNET_RPC_URL,
} from "@/lib/stellar";
import type { WalletSignatureResult } from "@/lib/wallet-adapter";

// ---------------------------------------------------------------------------
// Contribute on Testnet. One deep seam: createContributeFlow validates the
// amount, verifies membership, simulates, signs, submits, confirms, and
// re-reads the authoritative balance. The SDK executor (stellarContributeExecu-
// tor) is the only place that builds/invokes the contract. The token/SAC
// address never comes from a form: simulateContribute receives only the
// configured contract, the wallet member, and the amount, and the contract
// itself transfers from its stored config token.
// ---------------------------------------------------------------------------

export type ContributeErrorKind =
  | "invalid-amount"
  | "not-member"
  | "simulation-failed"
  | "wallet-rejected"
  | "wallet-network"
  | "wallet-unavailable"
  | "send-failed"
  | "transaction-failed"
  | "unknown";

export interface ContributeError {
  kind: ContributeErrorKind;
  message: string;
}

/** Display-only asset facts from the chain view; never form-supplied. */
export interface ContributeAsset {
  contractId: string;
  symbol: string | null;
  decimals: number | null;
}

export interface ContributeReview {
  /** Exact amount in integer base units. */
  amountBaseUnits: string;
  assetContractId: string;
  assetSymbol: string | null;
  assetDecimals: number | null;
  /**
   * Balance read from the chain before simulation. Null when the read
   * failed — a preview must never invent a number.
   */
  currentBalanceBaseUnits: string | null;
  /** current + amount, exact bigint math. Null when current is unreadable. */
  resultingBalanceBaseUnits: string | null;
}

export type PrepareContributeOutcome =
  | { status: "invalid-amount" | "not-member" | "simulation-failed"; error: ContributeError }
  | { status: "ready"; review: ContributeReview; preparedTxXdr: string };

export type SignAndSendContributeOutcome =
  | { status: "submitted"; hash: string }
  | { status: "sign-failed"; error: ContributeError }
  | { status: "send-failed"; error: ContributeError };

export type ConfirmContributeOutcome =
  | { status: "confirmed"; hash: string; balanceBaseUnits: string | null }
  | { status: "confirmation-pending"; hash: string }
  | { status: "failed"; hash: string | null; error: ContributeError };

// ---------------------------------------------------------------------------
// Executor seam. Wallet-mode contribution goes through this interface.
// ---------------------------------------------------------------------------

export interface ContributeExecutor {
  /**
   * Build and simulate the contribute invocation. Throws on any simulation
   * failure; a thrown promise means the wallet must not be asked to sign.
   */
  simulateContribute(input: {
    contractId: string;
    memberAddress: string;
    amountBaseUnits: bigint;
  }): Promise<{ preparedTxXdr: string }>;
  /** Submit the wallet-signed invocation; returns the transaction hash. */
  submitContribute(signedTxXdr: string): Promise<{ hash: string }>;
  /** Poll until SUCCESS/FAILED, or "pending" when still not terminal. */
  confirmContribute(hash: string): Promise<"success" | "failed" | "pending">;
}

export interface ContributeFlowDeps {
  executor: ContributeExecutor;
  contractId: string;
  memberAddress: string;
  asset: ContributeAsset;
  currentBalanceBaseUnits: string | null;
  isMember: () => Promise<boolean>;
  readBalance: () => Promise<bigint | null>;
  signTransaction: (transactionXdr: string) => Promise<WalletSignatureResult>;
}

export interface ContributeFlow {
  prepare(amountBaseUnits: unknown): Promise<PrepareContributeOutcome>;
  signAndSend(preparedTxXdr: string): Promise<SignAndSendContributeOutcome>;
  confirm(hash: string): Promise<ConfirmContributeOutcome>;
  /** Retry the authoritative balance re-read after a stale confirmation. */
  reReadBalance(): Promise<string | null>;
}

function errorOf(kind: ContributeErrorKind, message: string): ContributeError {
  return { kind, message };
}

// The SDK surfaces contract-host error discriminants as "Error(Contract, #N)"
// on some paths; CoholdError::NotMember = 3.
const CONTRACT_ERROR = /Error\(Contract, #(\d+)\)/;

function simulationError(error: unknown): ContributeError {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(CONTRACT_ERROR);
  if (match && Number(match[1]) === 3) {
    return errorOf("not-member", "Only members can add funds to this treasury.");
  }
  return errorOf(
    "simulation-failed",
    `Simulation failed — no funds were moved. (${message})`,
  );
}

function signatureError(result: WalletSignatureResult): ContributeError {
  switch (result.status) {
    case "cancelled":
      return errorOf("wallet-rejected", "Signature cancelled — no funds were moved.");
    case "wrong-network":
      return errorOf("wallet-network", "Switch Freighter to Stellar Testnet before signing.");
    case "not-connected":
      return errorOf("wallet-unavailable", "Connect Freighter before adding funds.");
    case "error":
      return errorOf(
        "wallet-unavailable",
        `Freighter signing failed — no funds were moved. (${result.message})`,
      );
  }
  // "signed" is handled by the caller; reaching this line means the union
  // gained a new member without a mapping here.
  return errorOf("unknown", "The transaction could not be signed.");
}

function sendError(error: unknown): ContributeError {
  const message = error instanceof Error ? error.message : String(error);
  return errorOf("send-failed", `Submission failed — no funds were moved. (${message})`);
}

function buildReview(
  amount: bigint,
  asset: ContributeAsset,
  currentBalanceBaseUnits: string | null,
): ContributeReview {
  let resultingBalanceBaseUnits: string | null = null;
  if (currentBalanceBaseUnits !== null && /^[0-9]+$/.test(currentBalanceBaseUnits)) {
    resultingBalanceBaseUnits = (BigInt(currentBalanceBaseUnits) + amount).toString();
  }
  return {
    amountBaseUnits: amount.toString(),
    assetContractId: asset.contractId,
    assetSymbol: asset.symbol,
    assetDecimals: asset.decimals,
    currentBalanceBaseUnits,
    resultingBalanceBaseUnits,
  };
}

export function createContributeFlow(deps: ContributeFlowDeps): ContributeFlow {
  const {
    executor,
    contractId,
    memberAddress,
    asset,
    currentBalanceBaseUnits,
    isMember,
    readBalance,
    signTransaction,
  } = deps;

  async function prepare(amountBaseUnits: unknown): Promise<PrepareContributeOutcome> {
    let amount: bigint;
    try {
      amount = parseBaseUnits(amountBaseUnits);
    } catch (error) {
      return {
        status: "invalid-amount",
        error: errorOf(
          "invalid-amount",
          error instanceof Error ? error.message : "Amount must be greater than zero.",
        ),
      };
    }

    let member: boolean;
    try {
      member = await isMember();
    } catch {
      return {
        status: "simulation-failed",
        error: errorOf(
          "simulation-failed",
          "Membership could not be verified on Testnet — retry in a moment.",
        ),
      };
    }
    if (!member) {
      return {
        status: "not-member",
        error: errorOf("not-member", "Only members can add funds to this treasury."),
      };
    }

    let prepared: { preparedTxXdr: string };
    try {
      prepared = await executor.simulateContribute({
        contractId,
        memberAddress,
        amountBaseUnits: amount,
      });
    } catch (error) {
      const mapped = simulationError(error);
      return {
        status: mapped.kind === "not-member" ? "not-member" : "simulation-failed",
        error: mapped,
      };
    }

    return {
      status: "ready",
      review: buildReview(amount, asset, currentBalanceBaseUnits),
      preparedTxXdr: prepared.preparedTxXdr,
    };
  }

  async function signAndSend(
    preparedTxXdr: string,
  ): Promise<SignAndSendContributeOutcome> {
    const signature = await signTransaction(preparedTxXdr);
    if (signature.status !== "signed") {
      return { status: "sign-failed", error: signatureError(signature) };
    }
    try {
      const { hash } = await executor.submitContribute(signature.signedTxXdr);
      return { status: "submitted", hash };
    } catch (error) {
      return { status: "send-failed", error: sendError(error) };
    }
  }

  async function confirm(hash: string): Promise<ConfirmContributeOutcome> {
    let result: "success" | "failed" | "pending";
    try {
      result = await executor.confirmContribute(hash);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: "failed",
        hash,
        error: errorOf(
          "unknown",
          `Could not confirm the transaction — verify the hash on Testnet. (${message})`,
        ),
      };
    }
    if (result === "pending") {
      return { status: "confirmation-pending", hash };
    }
    if (result === "failed") {
      return {
        status: "failed",
        hash,
        error: errorOf(
          "transaction-failed",
          "The transaction failed on Testnet — no funds were moved.",
        ),
      };
    }
    // SUCCESS is only a success once the balance re-read returns; a failed
    // re-read surfaces as stale (balance null), never an invented figure.
    let balance: bigint | null = null;
    try {
      balance = await readBalance();
    } catch {
      balance = null;
    }
    return {
      status: "confirmed",
      hash,
      balanceBaseUnits: balance === null ? null : balance.toString(),
    };
  }

  async function reReadBalance(): Promise<string | null> {
    try {
      const balance = await readBalance();
      return balance === null ? null : balance.toString();
    } catch {
      return null;
    }
  }

  return { prepare, signAndSend, confirm, reReadBalance };
}

// ---------------------------------------------------------------------------
// Stellar SDK implementation. simulateContribute runs before any signing;
// the wallet is never asked to sign a transaction that failed simulation.
// ---------------------------------------------------------------------------

export interface StellarContributeExecutorOptions {
  rpcUrl?: string;
  networkPassphrase?: string;
}

interface ContributeClientSpec {
  contribute: (
    args: { member: string; amount: bigint },
    options?: contract.MethodOptions,
  ) => Promise<contract.AssembledTransaction<unknown>>;
}

export function stellarContributeExecutor(
  options: StellarContributeExecutorOptions = {},
): ContributeExecutor {
  const rpcUrl = options.rpcUrl ?? STELLAR_TESTNET_RPC_URL;
  const networkPassphrase =
    options.networkPassphrase ?? STELLAR_TESTNET_NETWORK_PASSPHRASE;
  const server = new StellarSdk.rpc.Server(rpcUrl);

  return {
    async simulateContribute({ contractId, memberAddress, amountBaseUnits }) {
      const client = await contract.Client.from<ContributeClientSpec>({
        contractId,
        rpcUrl,
        networkPassphrase,
        // The invoker is the wallet member; their sequence/account drives the
        // simulation and their envelope signature authorizes the transfer.
        publicKey: memberAddress,
      });
      const tx = await client.contribute({
        member: memberAddress,
        amount: amountBaseUnits,
      });
      // Accessing the result surfaces a host-error simulation as a throw.
      try {
        void tx.result;
      } catch (error) {
        throw new Error(
          error instanceof Error && error.message
            ? error.message
            : "Contract simulation failed",
        );
      }
      if (tx.needsNonInvokerSigningBy().length > 0) {
        throw new Error(
          "This contribution needs multi-party authorization, which the MVP cannot sign.",
        );
      }
      return { preparedTxXdr: tx.toXDR() };
    },

    async submitContribute(signedTxXdr) {
      const transaction = StellarSdk.TransactionBuilder.fromXDR(
        signedTxXdr,
        networkPassphrase,
      );
      const response = await server.sendTransaction(transaction);
      if (response.status === "ERROR") {
        throw new Error("Testnet rejected the transaction — no funds were moved.");
      }
      return { hash: response.hash };
    },

    async confirmContribute(hash) {
      const response = await server.pollTransaction(hash, {
        attempts: 30,
        sleepStrategy: (attempt) => Math.min(2_000, 500 * attempt),
      });
      if (response.status === "SUCCESS") return "success";
      if (response.status === "FAILED") return "failed";
      return "pending";
    },
  };
}