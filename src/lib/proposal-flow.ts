import * as StellarSdk from "@stellar/stellar-sdk";
import { contract } from "@stellar/stellar-sdk";
import { Err, Ok, type ErrorMessage } from "@stellar/stellar-sdk/contract";
import { Client } from "cohold-contract";
import { formatBaseUnits, parseBaseUnits, parseNonNegativeBaseUnits } from "@/lib/money";
import { isValidStellarAddress } from "@/lib/stellar";
import {
  STELLAR_TESTNET_NETWORK_PASSPHRASE,
  STELLAR_TESTNET_RPC_URL,
} from "@/lib/stellar";
import type { ChainProposalStatus } from "@/lib/contract-adapter";
import type { WalletSignatureResult } from "@/lib/wallet-adapter";

// ---------------------------------------------------------------------------
// Create proposal and approve on Testnet. Two deep seams mirroring the
// contribute flow: createProposalFlow validates amount/recipient/description,
// verifies membership, simulates, signs, submits, confirms, and re-reads the
// created proposal; approveFlow verifies membership, simulates the approval,
// and re-reads the proposal after confirmation. The SDK executor
// (stellarProposalExecutor) is the only place that builds/invokes the
// contract. The token address, treasury, and proposer/member never come from
// a form: simulations receive only the configured contract, the wallet actor,
// and the reviewed fields, and the contract itself enforces membership and
// one-approval-per-member.
// ---------------------------------------------------------------------------

export type ProposalErrorKind =
  | "invalid-amount"
  | "invalid-recipient"
  | "invalid-description"
  | "not-member"
  | "already-approved"
  | "proposal-not-found"
  | "proposal-not-pending"
  | "proposal-not-approved"
  | "already-executed"
  | "insufficient-balance"
  | "simulation-failed"
  | "wallet-rejected"
  | "wallet-network"
  | "wallet-unavailable"
  | "send-failed"
  | "transaction-failed"
  | "unknown";

export interface ProposalError {
  kind: ProposalErrorKind;
  message: string;
  /**
   * Transaction hash when an ambiguous submission carried one: the network
   * may or may not have included the transaction, so the caller can
   * reconcile by confirming the hash instead of blindly retrying.
   */
  hash?: string | null;
}

/** Display-only asset facts from the chain view; never form-supplied. */
export interface ProposalAsset {
  contractId: string;
  symbol: string | null;
  decimals: number | null;
}

export interface CreateProposalReview {
  treasuryId: string;
  treasuryName: string;
  /** The acting wallet address; the contract authorizes this proposer. */
  proposerAddress: string;
  /** Exact amount in integer base units. */
  amountBaseUnits: string;
  recipient: string;
  description: string;
  assetContractId: string;
  assetSymbol: string | null;
  assetDecimals: number | null;
  /**
   * Treasury balance read from the chain before simulation. Informational
   * only — execution eligibility is checked by the contract on execute.
   */
  treasuryBalanceBaseUnits: string | null;
}

export interface ApproveProposalReview {
  treasuryId: string;
  treasuryName: string;
  memberAddress: string;
  proposalId: number;
  /** Proposal facts below come from the chain-backed view, never request input. */
  amountBaseUnits: string;
  recipient: string;
  description: string;
  assetSymbol: string | null;
  assetDecimals: number | null;
  approvalCount: number;
  threshold: number;
}

export interface ExecuteProposalReview {
  treasuryId: string;
  treasuryName: string;
  callerAddress: string;
  proposalId: number;
  status: ChainProposalStatus;
  /** Exact amount in integer base units. */
  amountBaseUnits: string;
  recipient: string;
  description: string;
  assetContractId: string;
  assetSymbol: string | null;
  assetDecimals: number | null;
  approvalCount: number;
  threshold: number;
  treasuryBalanceBaseUnits: string | null;
}

export type PrepareCreateOutcome =
  | {
      status:
        | "invalid-amount"
        | "invalid-recipient"
        | "invalid-description"
        | "not-member"
        | "simulation-failed";
      error: ProposalError;
    }
  | {
      status: "ready";
      review: CreateProposalReview;
      preparedTxXdr: string;
      /** Simulated proposal id; null when the simulation did not return one. */
      previewProposalId: number | null;
    };

export type PrepareApproveOutcome =
  | {
      status: "not-member" | "already-approved" | "proposal-not-found" | "proposal-not-pending" | "simulation-failed";
      error: ProposalError;
    }
  | { status: "ready"; review: ApproveProposalReview; preparedTxXdr: string };

export type PrepareExecuteOutcome =
  | {
      status:
        | "proposal-not-approved"
        | "already-executed"
        | "insufficient-balance"
        | "proposal-not-found"
        | "simulation-failed";
      error: ProposalError;
    }
  | { status: "ready"; review: ExecuteProposalReview; preparedTxXdr: string };

export type SignAndSendProposalOutcome =
  | { status: "submitted"; hash: string }
  | { status: "sign-failed"; error: ProposalError }
  | { status: "send-failed"; error: ProposalError };

export type ConfirmCreateOutcome =
  | {
      status: "confirmed";
      hash: string;
      /** Freshly re-read created proposal; null when the re-read could not be trusted. */
      proposalId: number | null;
      approvalCount: number | null;
      proposalStatus: ChainProposalStatus | null;
    }
  | { status: "confirmation-pending"; hash: string }
  | { status: "failed"; hash: string | null; error: ProposalError };

export type ConfirmApproveOutcome =
  | {
      status: "confirmed";
      hash: string;
      approvalCount: number | null;
      proposalStatus: ChainProposalStatus | null;
    }
  | { status: "confirmation-pending"; hash: string }
  | { status: "failed"; hash: string | null; error: ProposalError };

export type ConfirmExecuteOutcome =
  | {
      status: "confirmed";
      hash: string;
      approvalCount: number | null;
      proposalStatus: ChainProposalStatus | null;
      treasuryBalanceBaseUnits: string | null;
    }
  | { status: "confirmation-pending"; hash: string }
  | { status: "failed"; hash: string | null; error: ProposalError };

// ---------------------------------------------------------------------------
// Executor seam. Wallet-mode proposal operations go through this interface.
// ---------------------------------------------------------------------------

export interface ProposalExecutor {
  /**
   * Build and simulate the create-proposal invocation. Throws on any
   * simulation failure; a thrown promise means the wallet must not be asked
   * to sign. Returns the simulated proposal id when the contract returned one.
   */
  simulateCreateProposal(input: {
    contractId: string;
    proposerAddress: string;
    recipient: string;
    amountBaseUnits: bigint;
    description: string;
  }): Promise<{ preparedTxXdr: string; previewProposalId: bigint | null }>;
  /**
   * Build and simulate the approval invocation. Throws on any simulation
   * failure (including the contract's AlreadyApproved rejection).
   */
  simulateApprove(input: {
    contractId: string;
    memberAddress: string;
    proposalId: number;
  }): Promise<{ preparedTxXdr: string }>;
  /** Build and simulate the execute invocation. Throws on any simulation failure. */
  simulateExecute(input: {
    contractId: string;
    callerAddress: string;
    proposalId: number;
  }): Promise<{ preparedTxXdr: string }>;
  /** Submit the wallet-signed invocation; returns the transaction hash. */
  submitInvocation(signedTxXdr: string): Promise<{ hash: string }>;
  /** Poll until SUCCESS/FAILED, or "pending" when still not terminal. */
  confirmInvocation(hash: string): Promise<"success" | "failed" | "pending">;
}

export interface CreateProposalFlowDeps {
  executor: ProposalExecutor;
  contractId: string;
  treasuryName: string;
  memberAddress: string;
  asset: ProposalAsset;
  treasuryBalanceBaseUnits: string | null;
  isMember: () => Promise<boolean>;
  /** Authoritative proposal read; returns null when the proposal does not exist. */
  readProposal: (
    proposalId: number,
  ) => Promise<{
    proposalId: number;
    proposer: string;
    approvalCount: number;
    status: ChainProposalStatus;
    /**
     * Chain facts for creation confirmation. When present, confirmation
     * claims a proposal only if amount and recipient match the prepared
     * review exactly; a provider that cannot return facts is trusted via
     * proposer + id alone.
     */
    amountBaseUnits?: string;
    recipient?: string;
  } | null>;
  /** Current proposal count; the newest proposal id when reads are fresh. */
  readLatestProposalId: () => Promise<number | null>;
  signTransaction: (transactionXdr: string) => Promise<WalletSignatureResult>;
}

export interface ApproveFlowDeps {
  executor: ProposalExecutor;
  contractId: string;
  treasuryName: string;
  memberAddress: string;
  proposalId: number;
  /** Proposal facts the member reviews; must come from a chain-backed view. */
  reviewed: {
    amountBaseUnits: string;
    recipient: string;
    description: string;
    assetSymbol: string | null;
    assetDecimals: number | null;
    approvalCount: number;
    threshold: number;
  };
  isMember: () => Promise<boolean>;
  readProposal: (
    proposalId: number,
  ) => Promise<{
    approvalCount: number;
    status: ChainProposalStatus;
  } | null>;
  signTransaction: (transactionXdr: string) => Promise<WalletSignatureResult>;
}

export interface ExecuteFlowDeps {
  executor: ProposalExecutor;
  contractId: string;
  treasuryName: string;
  callerAddress: string;
  proposalId: number;
  reviewed: {
    status: ChainProposalStatus;
    amountBaseUnits: string;
    recipient: string;
    description: string;
    assetContractId: string;
    assetSymbol: string | null;
    assetDecimals: number | null;
    approvalCount: number;
    threshold: number;
    treasuryBalanceBaseUnits: string | null;
  };
  readProposal: (
    proposalId: number,
  ) => Promise<{
    approvalCount: number;
    status: ChainProposalStatus;
  } | null>;
  readBalance: () => Promise<bigint | null>;
  signTransaction: (transactionXdr: string) => Promise<WalletSignatureResult>;
}

export interface CreateProposalFlow {
  prepare(input: {
    amountBaseUnits: unknown;
    recipient: unknown;
    description: unknown;
  }): Promise<PrepareCreateOutcome>;
  /**
   * Signs the prepared XDR and submits it. `signedTxXdr` skips wallet signing
   * (the caller already signed) — used to surface a distinct submitting state.
   */
  signAndSend(preparedTxXdr: string, signedTxXdr?: string): Promise<SignAndSendProposalOutcome>;
  confirm(hash: string, previewProposalId: number | null): Promise<ConfirmCreateOutcome>;
}

export interface ApproveFlow {
  prepare(): Promise<PrepareApproveOutcome>;
  signAndSend(preparedTxXdr: string, signedTxXdr?: string): Promise<SignAndSendProposalOutcome>;
  confirm(hash: string): Promise<ConfirmApproveOutcome>;
}

export interface ExecuteFlow {
  prepare(): Promise<PrepareExecuteOutcome>;
  signAndSend(preparedTxXdr: string, signedTxXdr?: string): Promise<SignAndSendProposalOutcome>;
  confirm(hash: string): Promise<ConfirmExecuteOutcome>;
}

function errorOf(
  kind: ProposalErrorKind,
  message: string,
  hash?: string | null,
): ProposalError {
  return { kind, message, hash: hash ?? null };
}

// The SDK surfaces contract-host error discriminants as "Error(Contract, #N)"
// on some paths. CoholdError discriminants: NotMember = 3, AlreadyApproved = 8,
// ProposalNotFound = 9, ProposalNotPending = 10, ZeroAmount = 13.
const CONTRACT_ERROR = /Error\(Contract, #(\d+)\)/;

function mapContractError(
  error: unknown,
  context: "create" | "approve",
): ProposalError {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(CONTRACT_ERROR);
  const discriminant = match ? Number(match[1]) : null;
  if (context === "create") {
    if (discriminant === 3) {
      return errorOf("not-member", "Only members can create proposals in this treasury.");
    }
    if (discriminant === 13) {
      return errorOf("invalid-amount", "Amount must be greater than zero.");
    }
    return errorOf(
      "simulation-failed",
      `Simulation failed — no proposal was created. (${message})`,
    );
  }
  switch (discriminant) {
    case 3:
      return errorOf("not-member", "Only members can approve proposals in this treasury.");
    case 8:
      return errorOf("already-approved", "You have already approved this proposal.");
    case 9:
      return errorOf(
        "proposal-not-found",
        "This proposal no longer exists on Testnet — nothing was changed.",
      );
    case 10:
      return errorOf(
        "proposal-not-pending",
        "This proposal is no longer pending and cannot be approved.",
      );
    default:
      return errorOf(
        "simulation-failed",
        `Simulation failed — no approval was recorded. (${message})`,
      );
  }
}

function simulationError(
  error: unknown,
  context: "create" | "approve",
): ProposalError {
  return mapContractError(error, context);
}

function executeSimulationError(
  error: unknown,
  reviewed: ExecuteFlowDeps["reviewed"],
): ProposalError {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(CONTRACT_ERROR);
  const discriminant = match ? Number(match[1]) : null;
  switch (discriminant) {
    case 7: {
      const missing = reviewed.threshold - reviewed.approvalCount;
      return missing > 0
        ? errorOf(
            "proposal-not-approved",
            `This proposal needs ${missing} more approval${missing === 1 ? "" : "s"} before it can execute.`,
          )
        : errorOf(
            "proposal-not-approved",
            "This proposal is no longer approved and cannot be executed.",
          );
    }
    case 9:
      return errorOf(
        "proposal-not-found",
        "This proposal no longer exists on Testnet — nothing was changed.",
      );
    case 11:
      return errorOf("already-executed", "This proposal has already been executed.");
    case 12: {
      const availableLabel =
        reviewed.treasuryBalanceBaseUnits &&
        /^[0-9]+$/.test(reviewed.treasuryBalanceBaseUnits)
          ? formatBaseUnits(reviewed.treasuryBalanceBaseUnits)
          : null;
      return errorOf(
        "insufficient-balance",
        availableLabel
          ? `Treasury has ${availableLabel} base units available, but ${formatBaseUnits(reviewed.amountBaseUnits)} base units are required.`
          : `Treasury balance is not sufficient to execute this payment. ${formatBaseUnits(reviewed.amountBaseUnits)} base units are required.`,
      );
    }
    default:
      return errorOf(
        "simulation-failed",
        `Simulation failed — no payment was executed. (${message})`,
      );
  }
}

/** Shared by the flow signers and the dialogs that sign before submitting. */
export function signatureError(result: WalletSignatureResult): ProposalError {
  switch (result.status) {
    case "cancelled":
      return errorOf("wallet-rejected", "Signature cancelled — nothing was changed.");
    case "wrong-network":
      return errorOf("wallet-network", "Switch Freighter to Stellar Testnet before signing.");
    case "not-connected":
      return errorOf("wallet-unavailable", "Connect Freighter before changing treasury state.");
    case "error":
      return errorOf(
        "wallet-unavailable",
        `Freighter signing failed — nothing was changed. (${result.message})`,
      );
  }
  // "signed" is handled by the caller; reaching this line means the union
  // gained a new member without a mapping here.
  return errorOf("unknown", "The transaction could not be signed.");
}

function sendError(error: unknown): ProposalError {
  const message = error instanceof Error ? error.message : String(error);
  let hash: string | null = null;
  if (typeof error === "object" && error !== null && "hash" in error) {
    const candidate: unknown = error.hash;
    if (typeof candidate === "string" && candidate.length > 0) hash = candidate;
  }
  return errorOf(
    "send-failed",
    `Submission failed — nothing was changed. (${message})`,
    hash,
  );
}

function createReview(
  deps: CreateProposalFlowDeps,
  amount: bigint,
  recipient: string,
  description: string,
): CreateProposalReview {
  return {
    treasuryId: deps.contractId,
    treasuryName: deps.treasuryName,
    proposerAddress: deps.memberAddress,
    amountBaseUnits: amount.toString(),
    recipient,
    description,
    assetContractId: deps.asset.contractId,
    assetSymbol: deps.asset.symbol,
    assetDecimals: deps.asset.decimals,
    treasuryBalanceBaseUnits: deps.treasuryBalanceBaseUnits,
  };
}

export function createProposalFlow(deps: CreateProposalFlowDeps): CreateProposalFlow {
  const { executor, contractId, memberAddress, isMember, readProposal, signTransaction } =
    deps;

  // Facts of the most recent successful prepare; confirmation requires a
  // chain re-read with exactly these values before claiming a proposal.
  let lastPreparedFacts: { amountBaseUnits: string; recipient: string } | null = null;

  async function prepare(input: {
    amountBaseUnits: unknown;
    recipient: unknown;
    description: unknown;
  }): Promise<PrepareCreateOutcome> {
    let amount: bigint;
    try {
      amount = parseBaseUnits(input.amountBaseUnits);
    } catch (error) {
      return {
        status: "invalid-amount",
        error: errorOf(
          "invalid-amount",
          error instanceof Error ? error.message : "Amount must be greater than zero.",
        ),
      };
    }

    const recipient =
      typeof input.recipient === "string" ? input.recipient.trim().toUpperCase() : "";
    if (!recipient || !isValidStellarAddress(recipient)) {
      return {
        status: "invalid-recipient",
        error: errorOf(
          "invalid-recipient",
          "Recipient must be a valid Stellar address (G…).",
        ),
      };
    }

    const description =
      typeof input.description === "string" ? input.description.trim() : "";
    if (!description) {
      return {
        status: "invalid-description",
        error: errorOf(
          "invalid-description",
          "Describe the purpose of the spending before creating a proposal.",
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
        error: errorOf("not-member", "Only members can create proposals in this treasury."),
      };
    }

    let prepared: { preparedTxXdr: string; previewProposalId: bigint | null };
    try {
      prepared = await executor.simulateCreateProposal({
        contractId,
        proposerAddress: memberAddress,
        recipient,
        amountBaseUnits: amount,
        description,
      });
    } catch (error) {
      const mapped = simulationError(error, "create");
      return {
        status:
          mapped.kind === "not-member" || mapped.kind === "invalid-amount"
            ? mapped.kind
            : "simulation-failed",
        error: mapped,
      };
    }

    // The review facts feed confirmation: only a re-read whose amount and
    // recipient exactly match what this call prepared is claimed as created.
    lastPreparedFacts = { amountBaseUnits: amount.toString(), recipient };

    const previewProposalId =
      prepared.previewProposalId !== null &&
      prepared.previewProposalId >= 0n &&
      prepared.previewProposalId <= BigInt(Number.MAX_SAFE_INTEGER)
        ? Number(prepared.previewProposalId)
        : null;

    return {
      status: "ready",
      review: createReview(deps, amount, recipient, description),
      preparedTxXdr: prepared.preparedTxXdr,
      previewProposalId,
    };
  }

  async function signAndSend(
    preparedTxXdr: string,
    signedTxXdr?: string,
  ): Promise<SignAndSendProposalOutcome> {
    // A pre-signed XDR lets the caller surface a distinct submitting state
    // between wallet signing and RPC submission.
    const signature = signedTxXdr
      ? { status: "signed" as const, signedTxXdr }
      : await signTransaction(preparedTxXdr);
    if (signature.status !== "signed") {
      return { status: "sign-failed", error: signatureError(signature) };
    }
    try {
      const { hash } = await executor.submitInvocation(signature.signedTxXdr);
      return { status: "submitted", hash };
    } catch (error) {
      return { status: "send-failed", error: sendError(error) };
    }
  }

  async function confirm(
    hash: string,
    previewProposalId: number | null,
  ): Promise<ConfirmCreateOutcome> {
    let result: "success" | "failed" | "pending";
    try {
      result = await executor.confirmInvocation(hash);
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
          "The transaction failed on Testnet — no proposal was created.",
        ),
      };
    }

    // SUCCESS is only a success once the created proposal re-read returns.
    // The simulated id is tried first; when it is absent or stale, the newest
    // proposal is accepted only if the contract reports our wallet as its
    // proposer — another member's proposal is never claimed as ours.
    let read: {
      proposalId: number;
      proposer: string;
      approvalCount: number;
      status: ChainProposalStatus;
    } | null = null;
    const candidates = new Set<number>();
    if (previewProposalId !== null) candidates.add(previewProposalId);
    try {
      const latestId = await deps.readLatestProposalId();
      if (latestId !== null) candidates.add(latestId);
    } catch {
      // Keep whatever candidates already exist; a failed count read is stale,
      // never an invented proposal.
    }
    for (const candidate of candidates) {
      try {
        const proposal = await readProposal(candidate);
        if (!proposal || proposal.proposer !== memberAddress) continue;
        const hasFacts =
          typeof proposal.amountBaseUnits === "string" &&
          typeof proposal.recipient === "string";
        const factsMatch =
          lastPreparedFacts === null ||
          !hasFacts ||
          (proposal.amountBaseUnits === lastPreparedFacts.amountBaseUnits &&
            proposal.recipient === lastPreparedFacts.recipient);
        if (factsMatch) {
          read = proposal;
          break;
        }
      } catch {
        // Try the next candidate; a throwing read is stale, not authority.
      }
    }

    return {
      status: "confirmed",
      hash,
      proposalId: read?.proposalId ?? null,
      approvalCount: read?.approvalCount ?? null,
      proposalStatus: read?.status ?? null,
    };
  }

  return { prepare, signAndSend, confirm };
}

export function approveFlow(deps: ApproveFlowDeps): ApproveFlow {
  const {
    executor,
    contractId,
    memberAddress,
    proposalId,
    reviewed,
    isMember,
    readProposal,
    signTransaction,
  } = deps;

  async function prepare(): Promise<PrepareApproveOutcome> {
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
        error: errorOf("not-member", "Only members can approve proposals in this treasury."),
      };
    }

    let prepared: { preparedTxXdr: string };
    try {
      prepared = await executor.simulateApprove({
        contractId,
        memberAddress,
        proposalId,
      });
    } catch (error) {
      const mapped = simulationError(error, "approve");
      return {
        status:
          mapped.kind === "not-member" ||
          mapped.kind === "already-approved" ||
          mapped.kind === "proposal-not-found" ||
          mapped.kind === "proposal-not-pending"
            ? mapped.kind
            : "simulation-failed",
        error: mapped,
      };
    }

    // Review facts come from the chain-backed treasury/proposal view the
    // dialog was opened from, never from form input. The approve invocation
    // carries only the immutable proposal_id; the contract re-checks state,
    // so a stale review can only cause a clean rejection — never approve a
    // different amount or recipient.
    return {
      status: "ready",
      review: {
        treasuryId: contractId,
        treasuryName: deps.treasuryName,
        memberAddress,
        proposalId,
        amountBaseUnits: reviewed.amountBaseUnits,
        recipient: reviewed.recipient,
        description: reviewed.description,
        assetSymbol: reviewed.assetSymbol,
        assetDecimals: reviewed.assetDecimals,
        approvalCount: reviewed.approvalCount,
        threshold: reviewed.threshold,
      },
      preparedTxXdr: prepared.preparedTxXdr,
    };
  }

  async function signAndSend(
    preparedTxXdr: string,
    signedTxXdr?: string,
  ): Promise<SignAndSendProposalOutcome> {
    const signature = signedTxXdr
      ? { status: "signed" as const, signedTxXdr }
      : await signTransaction(preparedTxXdr);
    if (signature.status !== "signed") {
      return { status: "sign-failed", error: signatureError(signature) };
    }
    try {
      const { hash } = await executor.submitInvocation(signature.signedTxXdr);
      return { status: "submitted", hash };
    } catch (error) {
      return { status: "send-failed", error: sendError(error) };
    }
  }

  async function confirm(hash: string): Promise<ConfirmApproveOutcome> {
    let result: "success" | "failed" | "pending";
    try {
      result = await executor.confirmInvocation(hash);
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
          "The transaction failed on Testnet — no approval was recorded.",
        ),
      };
    }

    // SUCCESS is only a success once the proposal re-read returns; a failed
    // re-read surfaces as stale (nulls), never an invented approval count.
    let read: { approvalCount: number; status: ChainProposalStatus } | null = null;
    try {
      read = await readProposal(proposalId);
    } catch {
      read = null;
    }
    return {
      status: "confirmed",
      hash,
      approvalCount: read?.approvalCount ?? null,
      proposalStatus: read?.status ?? null,
    };
  }

  return { prepare, signAndSend, confirm };
}

export function executeFlow(deps: ExecuteFlowDeps): ExecuteFlow {
  const {
    executor,
    contractId,
    callerAddress,
    proposalId,
    reviewed,
    readProposal,
    readBalance,
    signTransaction,
  } = deps;

  async function prepare(): Promise<PrepareExecuteOutcome> {
    if (reviewed.status === "executed") {
      return {
        status: "already-executed",
        error: errorOf("already-executed", "This proposal has already been executed."),
      };
    }

    if (reviewed.status !== "approved" || reviewed.approvalCount < reviewed.threshold) {
      const missing = reviewed.threshold - reviewed.approvalCount;
      return {
        status: "proposal-not-approved",
        error: errorOf(
          "proposal-not-approved",
          missing > 0
            ? `This proposal needs ${missing} more approval${missing === 1 ? "" : "s"} before it can execute.`
            : "This proposal is not approved and cannot be executed.",
        ),
      };
    }

    if (reviewed.treasuryBalanceBaseUnits !== null) {
      try {
        const available = parseNonNegativeBaseUnits(reviewed.treasuryBalanceBaseUnits);
        const required = parseBaseUnits(reviewed.amountBaseUnits);
        if (available < required) {
          return {
            status: "insufficient-balance",
            error: errorOf(
              "insufficient-balance",
              `Treasury has ${formatBaseUnits(available)} base units available, but ${formatBaseUnits(required)} base units are required.`,
            ),
          };
        }
      } catch {
        // Fall through to chain simulation when the preview balance is unreadable.
      }
    }

    let prepared: { preparedTxXdr: string };
    try {
      prepared = await executor.simulateExecute({
        contractId,
        callerAddress,
        proposalId,
      });
    } catch (error) {
      const mapped = executeSimulationError(error, reviewed);
      return {
        status:
          mapped.kind === "proposal-not-approved" ||
          mapped.kind === "already-executed" ||
          mapped.kind === "insufficient-balance" ||
          mapped.kind === "proposal-not-found"
            ? mapped.kind
            : "simulation-failed",
        error: mapped,
      };
    }

    return {
      status: "ready",
      review: {
        treasuryId: contractId,
        treasuryName: deps.treasuryName,
        callerAddress,
        proposalId,
        status: reviewed.status,
        amountBaseUnits: reviewed.amountBaseUnits,
        recipient: reviewed.recipient,
        description: reviewed.description,
        assetContractId: reviewed.assetContractId,
        assetSymbol: reviewed.assetSymbol,
        assetDecimals: reviewed.assetDecimals,
        approvalCount: reviewed.approvalCount,
        threshold: reviewed.threshold,
        treasuryBalanceBaseUnits: reviewed.treasuryBalanceBaseUnits,
      },
      preparedTxXdr: prepared.preparedTxXdr,
    };
  }

  async function signAndSend(
    preparedTxXdr: string,
    signedTxXdr?: string,
  ): Promise<SignAndSendProposalOutcome> {
    const signature = signedTxXdr
      ? { status: "signed" as const, signedTxXdr }
      : await signTransaction(preparedTxXdr);
    if (signature.status !== "signed") {
      return { status: "sign-failed", error: signatureError(signature) };
    }
    try {
      const { hash } = await executor.submitInvocation(signature.signedTxXdr);
      return { status: "submitted", hash };
    } catch (error) {
      return { status: "send-failed", error: sendError(error) };
    }
  }

  async function confirm(hash: string): Promise<ConfirmExecuteOutcome> {
    let result: "success" | "failed" | "pending";
    try {
      result = await executor.confirmInvocation(hash);
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
          "The transaction failed on Testnet — no payment was executed.",
        ),
      };
    }

    let proposal: { approvalCount: number; status: ChainProposalStatus } | null = null;
    let balance: bigint | null = null;
    try {
      proposal = await readProposal(proposalId);
    } catch {
      proposal = null;
    }
    try {
      balance = await readBalance();
    } catch {
      balance = null;
    }

    if (proposal === null || balance === null || proposal.status !== "executed") {
      return { status: "confirmation-pending", hash };
    }

    return {
      status: "confirmed",
      hash,
      approvalCount: proposal.approvalCount,
      proposalStatus: proposal.status,
      treasuryBalanceBaseUnits: balance.toString(),
    };
  }

  return { prepare, signAndSend, confirm };
}

// ---------------------------------------------------------------------------
// Stellar SDK implementation. Both operations simulate before any signing;
// the wallet is never asked to sign a transaction that failed simulation.
// ---------------------------------------------------------------------------

export interface StellarProposalExecutorOptions {
  rpcUrl?: string;
  networkPassphrase?: string;
}

/**
 * The RPC reports a rejected invocation (host error) on the simulation
 * response while the assembled transaction still resolves; the message
 * carries the `Error(Contract, #N)` text the flow's classifier maps.
 * Without this, an Err-returning contract would ask the wallet to sign a
 * transaction that fails on submission.
 */
function simulationErrorOf(
  tx: contract.AssembledTransaction<unknown>,
): Error | null {
  const simulation = tx.simulation as
    | { error?: unknown; rest?: unknown }
    | undefined;
  if (
    simulation &&
    typeof simulation.error === "string" &&
    simulation.error.length > 0
  ) {
    return new Error(simulation.error);
  }
  return null;
}

function contractResultError(result: Err<ErrorMessage>, fallback: string): Error {
  const rawError: unknown = result.unwrapErr();
  const message =
    typeof rawError === "object" &&
    rawError !== null &&
    "message" in rawError &&
    typeof rawError.message === "string"
      ? rawError.message
      : rawError instanceof Error
        ? rawError.message
        : String(rawError);

  // `contract.Client` represents Result::Err as an Err wrapper containing the
  // base64-encoded ScError payload (not a ScVal). Decode it so CoholdError
  // discriminants remain available to the product error mapper even when
  // simulation itself is not rejected by the RPC.
  try {
    const decoded = StellarSdk.xdr.ScError.fromXDR(message, "base64");
    if (decoded.switch().name === "sceContract") {
      return new Error(`Error(Contract, #${String(decoded.contractCode())})`);
    }
  } catch {
    // Keep the provider's raw message when the result is not an ScError.
  }
  return new Error(message || fallback);
}

export function stellarProposalExecutor(
  options: StellarProposalExecutorOptions = {},
): ProposalExecutor {
  const rpcUrl = options.rpcUrl ?? STELLAR_TESTNET_RPC_URL;
  const networkPassphrase =
    options.networkPassphrase ?? STELLAR_TESTNET_NETWORK_PASSPHRASE;
  const server = new StellarSdk.rpc.Server(rpcUrl);

  return {
    async simulateCreateProposal({
      contractId,
      proposerAddress,
      recipient,
      amountBaseUnits,
      description,
    }) {
      const client = new Client({
        contractId,
        rpcUrl,
        networkPassphrase,
        // The invoker is the wallet proposer; their sequence/account drives
        // the simulation and their envelope signature authorizes the call.
        publicKey: proposerAddress,
      });
      const tx = await client.create_proposal({
        proposer: proposerAddress,
        recipient,
        amount: amountBaseUnits,
        description,
      });
      const rejected = simulationErrorOf(tx);
      if (rejected) throw rejected;
      // Result-typed returns arrive as Ok/Err wrappers; an Err here (when
      // the host did not flag the simulation) must never become a preview id.
      let preview: bigint;
      try {
        const result: unknown = tx.result;
        if (result instanceof Ok) {
          const value: unknown = result.unwrap();
          if (typeof value !== "bigint") {
            throw new Error("Contract returned an unexpected proposal id.");
          }
          preview = value;
        } else if (result instanceof Err) {
          throw new Error("Contract rejected the proposal.");
        } else if (typeof result !== "bigint") {
          throw new Error("Contract returned an unexpected proposal id.");
        } else {
          preview = result;
        }
      } catch (error) {
        throw new Error(
          error instanceof Error && error.message
            ? error.message
            : "Contract simulation failed",
        );
      }
      if (tx.needsNonInvokerSigningBy().length > 0) {
        throw new Error(
          "This proposal needs multi-party authorization, which the MVP cannot sign.",
        );
      }
      return { preparedTxXdr: tx.toXDR(), previewProposalId: preview };
    },

    async simulateApprove({ contractId, memberAddress, proposalId }) {
      const client = new Client({
        contractId,
        rpcUrl,
        networkPassphrase,
        publicKey: memberAddress,
      });
      const tx = await client.approve({
        member: memberAddress,
        proposal_id: BigInt(proposalId),
      });
      const rejected = simulationErrorOf(tx);
      if (rejected) throw rejected;
      try {
        const result: unknown = tx.result;
        if (result instanceof Err) {
          throw new Error("Contract rejected the approval.");
        }
        if (result instanceof Ok) {
          result.unwrap();
        }
      } catch (error) {
        throw new Error(
          error instanceof Error && error.message
            ? error.message
            : "Contract simulation failed",
        );
      }
      if (tx.needsNonInvokerSigningBy().length > 0) {
        throw new Error(
          "This approval needs multi-party authorization, which the MVP cannot sign.",
        );
      }
      return { preparedTxXdr: tx.toXDR() };
    },

    async simulateExecute({ contractId, callerAddress, proposalId }) {
      const client = new Client({
        contractId,
        rpcUrl,
        networkPassphrase,
        publicKey: callerAddress,
      });
      const tx = await client.execute({
        caller: callerAddress,
        proposal_id: BigInt(proposalId),
      });
      const rejected = simulationErrorOf(tx);
      if (rejected) throw rejected;
      try {
        const result: unknown = tx.result;
        if (result instanceof Err) {
          throw contractResultError(result, "Contract rejected the payment.");
        }
        if (result instanceof Ok) {
          result.unwrap();
        }
      } catch (error) {
        throw new Error(
          error instanceof Error && error.message
            ? error.message
            : "Contract simulation failed",
        );
      }
      if (tx.needsNonInvokerSigningBy().length > 0) {
        throw new Error(
          "This payment needs multi-party authorization, which the MVP cannot sign.",
        );
      }
      return { preparedTxXdr: tx.toXDR() };
    },

    async submitInvocation(signedTxXdr) {
      const transaction = StellarSdk.TransactionBuilder.fromXDR(
        signedTxXdr,
        networkPassphrase,
      );
      const response = await server.sendTransaction(transaction);
      if (response.status === "ERROR") {
        // The response hash lets the caller reconcile: the transaction may
        // never have been included, or may have failed with a post-simulation
        // contract rejection (e.g. a state race). Never describe it as a
        // clean rejection from here.
        throw Object.assign(
          new Error(
            "Testnet rejected the transaction — check its status before retrying.",
          ),
          { hash: response.hash },
        );
      }
      return { hash: response.hash };
    },

    async confirmInvocation(hash) {
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