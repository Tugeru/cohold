import { describe, expect, it } from "vitest";
import {
  buildWalletOverview,
  memberSlicesOnly,
  type WalletContractSlice,
} from "@/lib/wallet-overview";
import type {
  ChainProposalView,
  ChainTreasuryView,
} from "@/lib/contract-adapter";

const WALLET_A = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const WALLET_B = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBVF";

function treasury(overrides: Partial<ChainTreasuryView> = {}): ChainTreasuryView {
  return {
    contractId: "CCYKPLZE4OT7LIBUPWRQ4UGARQTOVBORYLV3ZQIKSKVI77Z5JVV3CVR2",
    name: "IT Society Event Fund",
    creator: WALLET_A,
    tokenAddress: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    tokenSymbol: "XLM",
    tokenDecimals: 7,
    balance: "1000000000",
    threshold: 2,
    memberCount: 2,
    members: [WALLET_A, WALLET_B],
    membersAuthoritative: true,
    ...overrides,
  };
}

function proposal(overrides: Partial<ChainProposalView> = {}): ChainProposalView {
  return {
    treasuryId: "CCYKPLZE4OT7LIBUPWRQ4UGARQTOVBORYLV3ZQIKSKVI77Z5JVV3CVR2",
    id: 1,
    description: "Backdrop rental",
    proposer: WALLET_A,
    recipient: WALLET_B,
    amount: "25000000",
    tokenSymbol: "XLM",
    tokenDecimals: 7,
    approvalCount: 1,
    threshold: 2,
    status: "pending",
    createdAt: 1000,
    currentUserApproval: "not-approved",
    ...overrides,
  };
}

function slice(overrides: Partial<WalletContractSlice> = {}): WalletContractSlice {
  return {
    contractId: "CCYKPLZE4OT7LIBUPWRQ4UGARQTOVBORYLV3ZQIKSKVI77Z5JVV3CVR2",
    treasury: treasury(),
    treasuryError: null,
    proposals: [],
    proposalsError: null,
    ...overrides,
  };
}

describe("memberSlicesOnly", () => {
  const memberSlice = slice({
    contractId: "CCYKPLZE4OT7LIBUPWRQ4UGARQTOVBORYLV3ZQIKSKVI77Z5JVV3CVR2",
  });
  const otherSlice = slice({
    contractId: "CABEVCDWFZ2W4W3H75T3DIOTEGHAVEPM2KETRROZNVHT2OVGUV4UVCYZ",
    treasury: treasury({
      contractId: "CABEVCDWFZ2W4W3H75T3DIOTEGHAVEPM2KETRROZNVHT2OVGUV4UVCYZ",
      members: [WALLET_B],
    }),
  });
  const failedSlice: WalletContractSlice = {
    contractId: "CCYKPLZE4OT7LIBUPWRQ4UGARQTOVBORYLV3ZQIKSKVI77Z5JVV3CVR2",
    treasury: null,
    treasuryError: "RPC unreachable",
    proposals: [],
    proposalsError: null,
  };

  it("keeps treasuries the wallet is a member of", () => {
    const kept = memberSlicesOnly([memberSlice, otherSlice], WALLET_A);
    expect(kept.map((s) => s.contractId)).toEqual([
      "CCYKPLZE4OT7LIBUPWRQ4UGARQTOVBORYLV3ZQIKSKVI77Z5JVV3CVR2",
    ]);
  });

  it("keeps failed reads because membership cannot be verified for them", () => {
    const kept = memberSlicesOnly([memberSlice, failedSlice], WALLET_A);
    expect(kept).toHaveLength(2);
    expect(kept[1].treasuryError).toBe("RPC unreachable");
  });

  it("drops everything when no wallet is connected", () => {
    expect(memberSlicesOnly([memberSlice], null)).toEqual([]);
  });
});

describe("buildWalletOverview", () => {
  it("sums loaded balances and skips failed balance reads", () => {
    const data = buildWalletOverview({
      walletAddress: WALLET_A,
      slices: [
        slice({
          treasury: treasury({ balance: "1000000000" }),
          proposals: [],
        }),
        slice({
          contractId: "CABEVCDWFZ2W4W3H75T3DIOTEGHAVEPM2KETRROZNVHT2OVGUV4UVCYZ",
          treasury: treasury({
            contractId: "CABEVCDWFZ2W4W3H75T3DIOTEGHAVEPM2KETRROZNVHT2OVGUV4UVCYZ",
            balance: null,
          }),
        }),
      ],
    });

    expect(data.totalBalanceBaseUnits).toBe(1000000000n);
    expect(data.totalTokenSymbol).toBe("XLM");
    expect(data.totalTokenDecimals).toBe(7);
  });

  it("keeps failed treasuries out of counts but reports them", () => {
    const data = buildWalletOverview({
      walletAddress: WALLET_A,
      slices: [
        slice({ treasury: null, treasuryError: "RPC read failed" }),
        slice({
          contractId: "CABEVCDWFZ2W4W3H75T3DIOTEGHAVEPM2KETRROZNVHT2OVGUV4UVCYZ",
          treasury: treasury({ contractId: "CABEVCDWFZ2W4W3H75T3DIOTEGHAVEPM2KETRROZNVHT2OVGUV4UVCYZ" }),
        }),
      ],
    });

    expect(data.treasuries).toHaveLength(1);
    expect(data.failedTreasuries).toHaveLength(1);
    expect(data.failedTreasuries[0].contractId).toBe(
      "CCYKPLZE4OT7LIBUPWRQ4UGARQTOVBORYLV3ZQIKSKVI77Z5JVV3CVR2",
    );
    expect(data.totalBalanceBaseUnits).toBe(1000000000n);
  });

  it("excludes proposals of a treasury whose proposal list failed to load", () => {
    const data = buildWalletOverview({
      walletAddress: WALLET_A,
      slices: [
        slice({ proposalsError: "proposal scan failed" }),
        slice({
          contractId: "CABEVCDWFZ2W4W3H75T3DIOTEGHAVEPM2KETRROZNVHT2OVGUV4UVCYZ",
          treasury: treasury({ contractId: "CABEVCDWFZ2W4W3H75T3DIOTEGHAVEPM2KETRROZNVHT2OVGUV4UVCYZ" }),
          proposals: [proposal({ treasuryId: "CABEVCDWFZ2W4W3H75T3DIOTEGHAVEPM2KETRROZNVHT2OVGUV4UVCYZ" })],
        }),
      ],
    });

    expect(data.failedProposals).toHaveLength(1);
    expect(data.proposals).toHaveLength(1);
  });

  it("counts only pending proposals in member treasuries the wallet has not approved", () => {
    const otherTreasuryId = "CABEVCDWFZ2W4W3H75T3DIOTEGHAVEPM2KETRROZNVHT2OVGUV4UVCYZ";
    const data = buildWalletOverview({
      walletAddress: WALLET_B,
      slices: [
        slice({
          proposals: [
            // Member treasury, not approved -> actionable.
            proposal({ id: 1, status: "pending", currentUserApproval: "not-approved" }),
            // Member treasury but already approved -> not actionable.
            proposal({ id: 2, status: "pending", currentUserApproval: "approved" }),
            // Member treasury, approval unknown -> never claimed as actionable.
            proposal({ id: 3, status: "pending", currentUserApproval: "unknown" }),
            // Executed -> not actionable.
            proposal({ id: 4, status: "executed", currentUserApproval: "not-approved" }),
          ],
        }),
        slice({
          contractId: otherTreasuryId,
          treasury: treasury({
            contractId: otherTreasuryId,
            members: [WALLET_A],
          }),
          proposals: [
            // Not a member of this treasury -> not actionable even though pending.
            proposal({ treasuryId: otherTreasuryId, id: 5, status: "pending", currentUserApproval: "not-approved" }),
          ],
        }),
      ],
    });

    expect(data.needsMyApproval.map((p) => p.id)).toEqual([1]);
  });

  it("reports nothing actionable without a connected wallet", () => {
    const data = buildWalletOverview({
      walletAddress: null,
      slices: [
        slice({
          proposals: [proposal({ status: "pending", currentUserApproval: "not-approved" })],
        }),
      ],
    });

    expect(data.needsMyApproval).toHaveLength(0);
  });

  it("treats membership as unverified (not a member) when the member list read failed", () => {
    const data = buildWalletOverview({
      walletAddress: WALLET_A,
      slices: [
        slice({
          treasury: treasury({ members: [], membersAuthoritative: false }),
          proposals: [proposal({ status: "pending", currentUserApproval: "not-approved" })],
        }),
      ],
    });

    expect(data.needsMyApproval).toHaveLength(0);
  });

  it("lists approved proposals as ready to disburse", () => {
    const data = buildWalletOverview({
      walletAddress: WALLET_A,
      slices: [slice({ proposals: [proposal({ id: 7, status: "approved" })] })],
    });

    expect(data.readyToDisburse.map((p) => p.id)).toEqual([7]);
  });

  it("returns recently executed newest-first and capped at five", () => {
    const data = buildWalletOverview({
      walletAddress: WALLET_A,
      slices: [
        slice({
          proposals: [
            proposal({ id: 1, status: "executed", createdAt: 100 }),
            proposal({ id: 2, status: "executed", createdAt: 200 }),
            proposal({ id: 3, status: "executed", createdAt: 300 }),
            proposal({ id: 4, status: "executed", createdAt: 400 }),
            proposal({ id: 5, status: "executed", createdAt: 500 }),
            proposal({ id: 6, status: "executed", createdAt: 600 }),
          ],
        }),
      ],
    });

    expect(data.recentlyExecuted.map((p) => p.id)).toEqual([6, 5, 4, 3, 2]);
  });

  it("handles empty input", () => {
    const data = buildWalletOverview({ walletAddress: null, slices: [] });

    expect(data.treasuries).toHaveLength(0);
    expect(data.totalBalanceBaseUnits).toBe(0n);
    expect(data.needsMyApproval).toHaveLength(0);
    expect(data.readyToDisburse).toHaveLength(0);
    expect(data.recentlyExecuted).toHaveLength(0);
  });
});