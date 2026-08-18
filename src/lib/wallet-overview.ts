import type {
  ChainProposalView,
  ChainTreasuryView,
} from "@/lib/contract-adapter";
import { isWalletMemberOfTreasury } from "@/lib/contract-adapter";
import { parseNonNegativeBaseUnits } from "@/lib/money";

/**
 * Wallet-mode overview assembly. Pure: chain reads happen in the view
 * component (per configured contract), then this module turns the slices
 * into the dashboard model. Unit-testable without React or RPC.
 */

/** One configured contract's read result before assembly. */
export interface WalletContractSlice {
  contractId: string;
  /** Null when the treasury read failed. */
  treasury: ChainTreasuryView | null;
  /** Treasury-read failure message, null when the treasury loaded. */
  treasuryError: string | null;
  /** [] when the treasury loaded but its proposals could not be read. */
  proposals: ChainProposalView[];
  /** Proposal-read failure message, null when proposals loaded. */
  proposalsError: string | null;
}

export interface WalletOverviewInput {
  slices: WalletContractSlice[];
  /** Uppercase connected wallet address, or null when not connected. */
  walletAddress: string | null;
}

export interface WalletOverviewData {
  /** Treasuries that loaded successfully. */
  treasuries: ChainTreasuryView[];
  /** Treasuries whose read failed, with reasons. */
  failedTreasuries: Array<{ contractId: string; message: string }>;
  /** Treasuries that loaded but whose proposals could not be read. */
  failedProposals: Array<{ contractId: string; message: string }>;
  /** Proposals from every treasury whose proposal list loaded. */
  proposals: ChainProposalView[];
  /**
   * Sum of loaded treasury balances in base units. Null balances (failed
   * reads) are skipped; zero when nothing loaded.
   */
  totalBalanceBaseUnits: bigint;
  /**
   * Symbol/decimals used to display the total: the first treasury with
   * known token metadata. Null when no treasury loaded with metadata.
   */
  totalTokenSymbol: string | null;
  totalTokenDecimals: number | null;
  /**
   * Pending proposals in treasuries the wallet is a member of that the
   * wallet has verifiably not approved. Empty until a wallet is connected;
   * `unknown` approval states are never counted as actionable.
   */
  needsMyApproval: ChainProposalView[];
  /** Proposals that reached quorum and can execute (permissionless). */
  readyToDisburse: ChainProposalView[];
  /** Executed proposals, newest first, capped for the dashboard. */
  recentlyExecuted: ChainProposalView[];
}

const RECENT_EXECUTED_CAP = 5;

/**
 * Keep only slices whose treasury the wallet is a member of — which covers
 * treasuries it created, since the contract locks the creator into the
 * member list. Failed reads stay: membership cannot be verified for them,
 * and dropping them would hide the wallet's own broken treasury.
 */
export function memberSlicesOnly(
  slices: WalletContractSlice[],
  walletAddress: string | null,
): WalletContractSlice[] {
  return slices.filter(
    (slice) =>
      slice.treasury === null ||
      isWalletMemberOfTreasury(slice.treasury, walletAddress),
  );
}

export function buildWalletOverview(input: WalletOverviewInput): WalletOverviewData {
  const treasuries: ChainTreasuryView[] = [];
  const failedTreasuries: Array<{ contractId: string; message: string }> = [];
  const failedProposals: Array<{ contractId: string; message: string }> = [];
  const proposals: ChainProposalView[] = [];

  let totalBalanceBaseUnits = 0n;
  let totalTokenSymbol: string | null = null;
  let totalTokenDecimals: number | null = null;

  const memberTreasuryIds = new Set<string>();

  for (const slice of input.slices) {
    if (!slice.treasury) {
      failedTreasuries.push({
        contractId: slice.contractId,
        message: slice.treasuryError ?? "Treasury could not be read from chain.",
      });
      continue;
    }
    treasuries.push(slice.treasury);

    if (slice.treasury.balance !== null) {
      try {
        totalBalanceBaseUnits += parseNonNegativeBaseUnits(slice.treasury.balance);
      } catch {
        // Keep a failed balance read out of the total; the card still
        // renders with the healthy treasuries' sum.
      }
    }
    if (totalTokenSymbol === null && slice.treasury.tokenSymbol) {
      totalTokenSymbol = slice.treasury.tokenSymbol;
      totalTokenDecimals = slice.treasury.tokenDecimals;
    }

    const verifiedMembership =
      input.walletAddress !== null &&
      slice.treasury.membersAuthoritative &&
      slice.treasury.members.includes(input.walletAddress);
    if (verifiedMembership) {
      memberTreasuryIds.add(slice.contractId);
    }

    if (slice.proposalsError !== null) {
      failedProposals.push({
        contractId: slice.contractId,
        message: slice.proposalsError,
      });
      continue;
    }
    proposals.push(...slice.proposals);
  }

  const needsMyApproval = proposals.filter(
    (proposal) =>
      proposal.status === "pending" &&
      memberTreasuryIds.has(proposal.treasuryId) &&
      proposal.currentUserApproval === "not-approved",
  );
  const readyToDisburse = proposals.filter(
    (proposal) => proposal.status === "approved",
  );
  const recentlyExecuted = proposals
    .filter((proposal) => proposal.status === "executed")
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, RECENT_EXECUTED_CAP);

  return {
    treasuries,
    failedTreasuries,
    failedProposals,
    proposals,
    totalBalanceBaseUnits,
    totalTokenSymbol,
    totalTokenDecimals,
    needsMyApproval,
    readyToDisburse,
    recentlyExecuted,
  };
}