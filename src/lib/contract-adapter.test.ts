import { describe, expect, it, vi } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import {
  buildProposalView,
  buildTreasuryView,
  currentUserApprovalState,
  isWalletMemberOfTreasury,
  loadWalletActivity,
  loadWalletProposal,
  loadWalletProposalViews,
  loadWalletTreasury,
  mergeTreasuryMetadata,
  normalizeActivityEvent,
  normalizeProposalResult,
  normalizeStatus,
  normalizeTreasuryConfigResult,
  stellarCoholdRpc,
  type ChainActivityView,
  type ChainProposalRecord,
  type ChainTreasuryConfig,
  type CoholdRpc,
} from "./contract-adapter";

const CONTRACT = `C${"A".repeat(55)}`;
const TOKEN = `C${"B".repeat(55)}`;
const MEMBER_ONE = `G${"A".repeat(55)}`;
const MEMBER_TWO = `G${"B".repeat(55)}`;
const OUTSIDER = `G${"C".repeat(55)}`;

const config: ChainTreasuryConfig = {
  name: "IT Society Event Fund",
  creator: MEMBER_ONE,
  tokenAddress: TOKEN,
  threshold: 2,
  memberCount: 3,
};

const record: ChainProposalRecord = {
  id: 7,
  proposer: MEMBER_ONE,
  recipient: OUTSIDER,
  amount: 4_500_000_000n,
  description: "Venue deposit",
  approvalCount: 2,
  status: "approved",
  createdAt: 1_750_000_000,
};

function mockRpc(overrides: Partial<CoholdRpc> = {}): CoholdRpc {
  const calls: Record<string, number> = {};
  const rpc: CoholdRpc = {
    async getHealth() {
      return true;
    },
    async getConfig() {
      calls.getConfig = (calls.getConfig ?? 0) + 1;
      return config;
    },
    async getBalance() {
      return 10_000_000_000n;
    },
    async getProposalCount() {
      return 3;
    },
    async getProposal(_contractId, proposalId) {
      if (proposalId === 2) return null;
      return { ...record, id: proposalId, status: proposalId === 3 ? "pending" : "approved" };
    },
    async getMemberList() {
      return [MEMBER_ONE, MEMBER_TWO];
    },
    async isMember(_contractId, address) {
      return address === MEMBER_ONE || address === MEMBER_TWO;
    },
    async hasApproved() {
      return true;
    },
    async getTokenInfo() {
      return { symbol: "USDC", decimals: 7 };
    },
    async getRecentEvents() {
      return [];
    },
    ...overrides,
  };
  return Object.assign(rpc, { __calls: calls });
}

describe("normalizeStatus", () => {
  it("maps contract enum discriminants to proposal statuses", () => {
    expect(normalizeStatus(0)).toBe("pending");
    expect(normalizeStatus(1)).toBe("approved");
    expect(normalizeStatus(2)).toBe("executed");
    expect(normalizeStatus(3)).toBe("cancelled");
  });

  it("accepts symbol-shaped statuses from defensive parsing", () => {
    expect(normalizeStatus("Pending")).toBe("pending");
    expect(normalizeStatus("Approved")).toBe("approved");
    expect(normalizeStatus("Executed")).toBe("executed");
    expect(normalizeStatus("Cancelled")).toBe("cancelled");
    expect(normalizeStatus("pending")).toBe("pending");
  });

  it("rejects unknown, negative, or malformed statuses", () => {
    expect(normalizeStatus(4)).toBeNull();
    expect(normalizeStatus(-1)).toBeNull();
    expect(normalizeStatus("Bogus")).toBeNull();
    expect(normalizeStatus(undefined)).toBeNull();
    expect(normalizeStatus(null)).toBeNull();
  });
});

describe("normalizeTreasuryConfigResult", () => {
  it("normalizes the spec-driven object shape", () => {
    const value = {
      creator: MEMBER_ONE,
      token: TOKEN,
      threshold: 2,
      member_count: 3,
      name: "IT Society Event Fund",
    };
    expect(normalizeTreasuryConfigResult(value)).toEqual(config);
  });

  it("normalizes the positional array shape from raw ScVal conversion", () => {
    const value = [MEMBER_ONE, TOKEN, 2, 3, "IT Society Event Fund"];
    expect(normalizeTreasuryConfigResult(value)).toEqual(config);
  });

  it("rejects missing or malformed config results", () => {
    expect(normalizeTreasuryConfigResult(null)).toBeNull();
    expect(normalizeTreasuryConfigResult(undefined)).toBeNull();
    expect(normalizeTreasuryConfigResult({})).toBeNull();
    expect(
      normalizeTreasuryConfigResult({
        creator: "not-an-address",
        token: TOKEN,
        threshold: 2,
        member_count: 3,
        name: "x",
      }),
    ).toBeNull();
    expect(
      normalizeTreasuryConfigResult({
        creator: MEMBER_ONE,
        token: TOKEN,
        threshold: 0,
        member_count: 0,
        name: "x",
      }),
    ).toBeNull();
  });
});

describe("normalizeProposalResult", () => {
  it("normalizes the spec-driven object shape with BigInt fields", () => {
    const value = {
      id: 7n,
      proposer: MEMBER_ONE,
      recipient: OUTSIDER,
      amount: 4_500_000_000n,
      description: "Venue deposit",
      approval_count: 2,
      status: 1,
      created_at: 1_750_000_000n,
    };
    expect(normalizeProposalResult(value)).toEqual(record);
  });

  it("normalizes the positional array shape", () => {
    const value = [
      7n,
      MEMBER_ONE,
      OUTSIDER,
      4_500_000_000n,
      "Venue deposit",
      2,
      1,
      1_750_000_000n,
    ];
    expect(normalizeProposalResult(value)).toEqual(record);
  });

  it("accepts numeric string amounts and symbol statuses", () => {
    const value = {
      id: 7,
      proposer: MEMBER_ONE,
      recipient: OUTSIDER,
      amount: "4500000000",
      description: "Venue deposit",
      approval_count: 2,
      status: "Approved",
      created_at: 1_750_000_000,
    };
    expect(normalizeProposalResult(value)?.amount).toBe(4_500_000_000n);
    expect(normalizeProposalResult(value)?.status).toBe("approved");
  });

  it("rejects malformed, zero, or negative amounts", () => {
    const base = {
      id: 1n,
      proposer: MEMBER_ONE,
      recipient: OUTSIDER,
      description: "x",
      approval_count: 1,
      status: 0,
      created_at: 1n,
    };
    expect(normalizeProposalResult({ ...base, amount: 0n })).toBeNull();
    expect(normalizeProposalResult({ ...base, amount: -5n })).toBeNull();
    expect(normalizeProposalResult({ ...base, amount: "abc" })).toBeNull();
    expect(normalizeProposalResult(null)).toBeNull();
    expect(normalizeProposalResult({ ...base, amount: 5n })).not.toBeNull();
  });

  it("rejects results with unknown proposal statuses", () => {
    const value = {
      id: 7n,
      proposer: MEMBER_ONE,
      recipient: OUTSIDER,
      amount: 5n,
      description: "x",
      approval_count: 1,
      status: 42,
      created_at: 1_750_000_000n,
    };
    expect(normalizeProposalResult(value)).toBeNull();
  });
});

describe("buildTreasuryView", () => {
  it("exposes balance and token as clean display-ready values", () => {
    const view = buildTreasuryView({
      contractId: CONTRACT,
      config,
      balance: 10_000_000_000n,
      members: [MEMBER_ONE, MEMBER_TWO],
      token: { symbol: "USDC", decimals: 7 },
    });

    expect(view).toEqual({
      contractId: CONTRACT,
      name: "IT Society Event Fund",
      creator: MEMBER_ONE,
      tokenAddress: TOKEN,
      tokenSymbol: "USDC",
      tokenDecimals: 7,
      balance: "10000000000",
      threshold: 2,
      memberCount: 3,
      members: [MEMBER_ONE, MEMBER_TWO],
      membersAuthoritative: true,
    });
  });

  it("flags non-authoritative members when the member list is unavailable", () => {
    const view = buildTreasuryView({
      contractId: CONTRACT,
      config,
      balance: 0n,
      members: null,
      token: null,
    });

    expect(view.members).toEqual([]);
    expect(view.membersAuthoritative).toBe(false);
    expect(view.tokenSymbol).toBeNull();
    expect(view.tokenDecimals).toBeNull();
  });
});

describe("isWalletMemberOfTreasury", () => {
  const view = buildTreasuryView({
    contractId: CONTRACT,
    config,
    balance: 0n,
    members: [MEMBER_ONE, MEMBER_TWO],
    token: null,
  });

  it("is true when the wallet is in the member list, case-insensitively", () => {
    expect(isWalletMemberOfTreasury(view, MEMBER_TWO)).toBe(true);
    expect(isWalletMemberOfTreasury(view, MEMBER_TWO.toLowerCase())).toBe(true);
  });

  it("is false for a wallet outside the member list", () => {
    expect(isWalletMemberOfTreasury(view, OUTSIDER)).toBe(false);
  });

  it("is false without a connected wallet", () => {
    expect(isWalletMemberOfTreasury(view, null)).toBe(false);
    expect(isWalletMemberOfTreasury(view, "")).toBe(false);
  });

  it("never claims membership from an unverified member list", () => {
    const unverified = buildTreasuryView({
      contractId: CONTRACT,
      config,
      balance: 0n,
      members: null,
      token: null,
    });
    expect(isWalletMemberOfTreasury(unverified, MEMBER_ONE)).toBe(false);
  });

  it("is false for an empty member list", () => {
    const empty = buildTreasuryView({
      contractId: CONTRACT,
      config,
      balance: 0n,
      members: [],
      token: null,
    });
    expect(isWalletMemberOfTreasury(empty, MEMBER_ONE)).toBe(false);
  });
});

describe("mergeTreasuryMetadata", () => {
  const chain = buildTreasuryView({
    contractId: CONTRACT,
    config,
    balance: 10_000_000_000n,
    members: [MEMBER_ONE],
    token: { symbol: "USDC", decimals: 7 },
  });

  it("keeps the chain value for every disagreeing authoritative field", () => {
    const merged = mergeTreasuryMetadata(chain, {
      name: "Wrong Local Name",
      balance: "1",
      threshold: 99,
      memberCount: 1,
      tokenSymbol: "PHP",
      members: ["GAVENUE999HOTELCENTRALHALLTESTNETRECIPIENT1"],
      creator: OUTSIDER,
      tokenAddress: `C${"C".repeat(55)}`,
    });

    expect(merged.name).toBe("IT Society Event Fund");
    expect(merged.balance).toBe("10000000000");
    expect(merged.threshold).toBe(2);
    expect(merged.memberCount).toBe(3);
    expect(merged.tokenSymbol).toBe("USDC");
    expect(merged.members).toEqual([MEMBER_ONE]);
    expect(merged.creator).toBe(MEMBER_ONE);
    expect(merged.tokenAddress).toBe(TOKEN);
    expect(merged.metadata?.droppedFields).toEqual(
      expect.arrayContaining([
        "name",
        "balance",
        "threshold",
        "memberCount",
        "tokenSymbol",
        "members",
        "creator",
        "tokenAddress",
      ]),
    );
    expect(merged.metadata?.fields).not.toHaveProperty("name");
    expect(merged.metadata?.fields).not.toHaveProperty("balance");
  });

  it("keeps local metadata that does not disagree with the chain", () => {
    const merged = mergeTreasuryMetadata(chain, {
      description: "Org fund for events",
      category: "student_org",
    });

    expect(merged.name).toBe("IT Society Event Fund");
    expect(merged.metadata?.fields).toEqual({
      description: "Org fund for events",
      category: "student_org",
    });
    expect(merged.metadata?.droppedFields).toEqual([]);
  });

  it("keeps equal-valued metadata as non-authoritative without a conflict", () => {
    const merged = mergeTreasuryMetadata(chain, { threshold: 2, balance: "10000000000" });

    expect(merged.threshold).toBe(2);
    expect(merged.balance).toBe("10000000000");
    expect(merged.metadata?.droppedFields).toEqual([]);
    expect(merged.metadata?.fields).toEqual({ threshold: 2, balance: "10000000000" });
  });

  it("marks the metadata source as local and non-authoritative", () => {
    const merged = mergeTreasuryMetadata(chain, { category: "other" });

    expect(merged.metadata?.source).toBe("local-metadata");
    expect(merged.metadata).toBeDefined();
  });
});

describe("currentUserApprovalState", () => {
  it("is unknown without a connected wallet", () => {
    expect(
      currentUserApprovalState({ userAddress: null, isMember: null, hasApproved: null }),
    ).toBe("unknown");
  });

  it("is unknown when membership cannot be verified", () => {
    expect(
      currentUserApprovalState({
        userAddress: MEMBER_ONE,
        isMember: null,
        hasApproved: null,
      }),
    ).toBe("unknown");
  });

  it("is unknown for non-members instead of claiming they may approve", () => {
    expect(
      currentUserApprovalState({
        userAddress: OUTSIDER,
        isMember: false,
        hasApproved: null,
      }),
    ).toBe("unknown");
  });

  it("is unknown when the approval read fails for a member", () => {
    expect(
      currentUserApprovalState({
        userAddress: MEMBER_ONE,
        isMember: true,
        hasApproved: null,
      }),
    ).toBe("unknown");
  });

  it("reports approved and not-approved only for verified members", () => {
    expect(
      currentUserApprovalState({ userAddress: MEMBER_ONE, isMember: true, hasApproved: true }),
    ).toBe("approved");
    expect(
      currentUserApprovalState({ userAddress: MEMBER_ONE, isMember: true, hasApproved: false }),
    ).toBe("not-approved");
  });
});

describe("buildProposalView", () => {
  it("exposes a clean proposal view with approval progress and asset", () => {
    const view = buildProposalView({
      treasuryId: CONTRACT,
      record,
      threshold: 2,
      token: { symbol: "USDC", decimals: 7 },
      currentUserApproval: "approved",
    });

    expect(view).toEqual({
      treasuryId: CONTRACT,
      id: 7,
      description: "Venue deposit",
      proposer: MEMBER_ONE,
      recipient: OUTSIDER,
      amount: "4500000000",
      tokenSymbol: "USDC",
      tokenDecimals: 7,
      approvalCount: 2,
      threshold: 2,
      status: "approved",
      createdAt: 1_750_000_000,
      currentUserApproval: "approved",
    });
  });
});

describe("loadWalletTreasury", () => {
  it("assembles chain config, balance, members, and token into a view", async () => {
    const rpc = mockRpc();
    const view = await loadWalletTreasury(rpc, CONTRACT);

    expect(view).not.toBeNull();
    expect(view?.contractId).toBe(CONTRACT);
    expect(view?.balance).toBe("10000000000");
    expect(view?.members).toEqual([MEMBER_ONE, MEMBER_TWO]);
    expect(view?.membersAuthoritative).toBe(true);
    expect(view?.tokenSymbol).toBe("USDC");
  });

  it("throws when the configured contract has no config", async () => {
    const rpc = mockRpc({ getConfig: async () => null });
    await expect(loadWalletTreasury(rpc, CONTRACT)).rejects.toThrow(/not initialized/);
  });

  it("keeps the view loadable when member list or token metadata reads fail", async () => {
    const rpc = mockRpc({
      getMemberList: async () => null,
      getTokenInfo: async () => {
        throw new Error("rpc unavailable");
      },
    });
    const view = await loadWalletTreasury(rpc, CONTRACT);

    expect(view?.members).toEqual([]);
    expect(view?.membersAuthoritative).toBe(false);
    expect(view?.tokenSymbol).toBeNull();
    expect(view?.tokenDecimals).toBeNull();
    expect(view?.balance).toBe("10000000000");
  });

  it("never invents a balance when the balance read fails", async () => {
    const rpc = mockRpc({
      getBalance: async () => null,
    });
    const view = await loadWalletTreasury(rpc, CONTRACT);
    expect(view?.balance).toBeNull();

    const failing = mockRpc({
      getBalance: async () => {
        throw new Error("rpc unavailable");
      },
    });
    const failedView = await loadWalletTreasury(failing, CONTRACT);
    expect(failedView?.balance).toBeNull();
  });
});

describe("loadWalletProposalViews", () => {
  it("lists proposals from the count and per-id reads, skipping gaps", async () => {
    const rpc = mockRpc();
    const views = await loadWalletProposalViews(rpc, CONTRACT);

    expect(views.map((v) => v.id)).toEqual([1, 3]);
    expect(views[0].currentUserApproval).toBe("unknown");
    expect(views[0].amount).toBe("4500000000");
    expect(views[0].tokenSymbol).toBe("USDC");
    expect(views[0].tokenDecimals).toBe(7);
  });

  it("marks approval states from the connected member's reads", async () => {
    const rpc = mockRpc({
      hasApproved: async (_c, id) => id !== 3,
    });
    const views = await loadWalletProposalViews(rpc, CONTRACT, MEMBER_ONE);

    expect(views.find((v) => v.id === 1)?.currentUserApproval).toBe("approved");
    expect(views.find((v) => v.id === 3)?.currentUserApproval).toBe("not-approved");
  });

  it("checks membership once per treasury for the current user", async () => {
    let membershipChecks = 0;
    const rpc = mockRpc({
      isMember: async () => {
        membershipChecks += 1;
        return false;
      },
    });
    await loadWalletProposalViews(rpc, CONTRACT, OUTSIDER);

    expect(membershipChecks).toBe(1);
  });

  it("treats a non-member user's approval as unknown for every proposal", async () => {
    const rpc = mockRpc({ isMember: async () => false });
    const views = await loadWalletProposalViews(rpc, CONTRACT, OUTSIDER);

    expect(views.every((v) => v.currentUserApproval === "unknown")).toBe(true);
  });

  it("returns an empty list when the contract has no proposals", async () => {
    const rpc = mockRpc({ getProposalCount: async () => 0 });
    expect(await loadWalletProposalViews(rpc, CONTRACT)).toEqual([]);
  });

  it("throws instead of presenting an unreadable count as an empty list", async () => {
    const rpc = mockRpc({ getProposalCount: async () => null });
    await expect(loadWalletProposalViews(rpc, CONTRACT)).rejects.toThrow(
      /proposal count could not be read/,
    );
  });

  it("throws instead of presenting a missing config as an empty list", async () => {
    const rpc = mockRpc({ getConfig: async () => null });
    await expect(loadWalletProposalViews(rpc, CONTRACT)).rejects.toThrow(
      /not initialized/,
    );
  });
});

describe("loadWalletProposal", () => {
  it("loads a single proposal with approval progress", async () => {
    const rpc = mockRpc({ isMember: async () => true, hasApproved: async () => true });
    const view = await loadWalletProposal(rpc, CONTRACT, 1, MEMBER_ONE);

    expect(view?.id).toBe(1);
    expect(view?.threshold).toBe(2);
    expect(view?.approvalCount).toBe(2);
    expect(view?.currentUserApproval).toBe("approved");
  });

  it("returns null for missing proposals", async () => {
    const rpc = mockRpc({ getProposal: async () => null });
    expect(await loadWalletProposal(rpc, CONTRACT, 99, null)).toBeNull();
  });
  it("throws when an existing-range proposal cannot be read", async () => {
    const rpc = mockRpc({ getProposal: async () => null });
    await expect(loadWalletProposal(rpc, CONTRACT, 1, null)).rejects.toThrow(/could not be read/);
  });
});

describe("normalizeActivityEvent", () => {
  const TX = "a".repeat(64);
  const CREATOR = `G${"D".repeat(55)}`;
  const RECIPIENT = `G${"E".repeat(55)}`;

  function rawEvent(
    overrides: Partial<Parameters<typeof normalizeActivityEvent>[0]> = {},
  ) {
    return {
      id: "event-1",
      txHash: TX,
      ledger: 1234,
      createdAt: "2026-08-10T00:00:00Z",
      inSuccessfulContractCall: true,
      topic: [],
      value: [],
      ...overrides,
    };
  }

  it("normalizes treasury/created into a creator activity", () => {
    const event = normalizeActivityEvent(
      rawEvent({ topic: ["treasury", "created"], value: [CREATOR, 3, 4] }),
    );
    expect(event).toMatchObject({
      type: "treasury-created",
      actor: CREATOR,
      ledger: 1234,
      txHash: TX,
      createdAt: "2026-08-10T00:00:00Z",
    });
    expect(event?.proposalId).toBeUndefined();
    expect(event?.amountBaseUnits).toBeUndefined();
  });

  it("normalizes treasury/deposit with an i128-scale amount", () => {
    const event = normalizeActivityEvent(
      rawEvent({ topic: ["treasury", "deposit"], value: [CREATOR, 10_000_000_000n, 30_000_000_000n] }),
    );
    expect(event).toMatchObject({
      type: "deposit",
      actor: CREATOR,
      amountBaseUnits: 10_000_000_000n,
    });
  });

  it("normalizes proposal/created with proposer, id, and amount", () => {
    const event = normalizeActivityEvent(
      rawEvent({
        topic: ["proposal", "created"],
        value: [7, CREATOR, 4_500_000_000n],
      }),
    );
    expect(event).toMatchObject({
      type: "proposal-created",
      proposalId: 7,
      actor: CREATOR,
      amountBaseUnits: 4_500_000_000n,
    });
  });

  it("normalizes proposal/approved without an actor", () => {
    const event = normalizeActivityEvent(
      rawEvent({ topic: ["proposal", "approved"], value: [7, 2] }),
    );
    expect(event).toMatchObject({ type: "proposal-approved", proposalId: 7 });
    expect(event?.actor).toBeUndefined();
  });

  it("normalizes approval/signed with the member", () => {
    const event = normalizeActivityEvent(
      rawEvent({ topic: ["approval", "signed"], value: [7, CREATOR] }),
    );
    expect(event).toMatchObject({ type: "approval-signed", proposalId: 7, actor: CREATOR });
  });

  it("normalizes execute/paid with recipient and amount", () => {
    const event = normalizeActivityEvent(
      rawEvent({ topic: ["execute", "paid"], value: [7, RECIPIENT, 4_500_000_000n] }),
    );
    expect(event).toMatchObject({
      type: "payment-paid",
      proposalId: 7,
      recipient: RECIPIENT,
      amountBaseUnits: 4_500_000_000n,
    });
    expect(event?.actor).toBeUndefined();
  });

  it("uppercases address fields", () => {
    const event = normalizeActivityEvent(
      rawEvent({
        topic: ["approval", "signed"],
        value: [7, CREATOR.toLowerCase()],
      }),
    );
    expect(event?.actor).toBe(CREATOR);
  });

  it("preserves i128 amounts beyond the safe-integer range", () => {
    const huge = 9_000_000_000_000_000_000_000n;
    const event = normalizeActivityEvent(
      rawEvent({ topic: ["execute", "paid"], value: [7, RECIPIENT, huge] }),
    );
    expect(event?.amountBaseUnits).toBe(huge);
  });

  it("rejects events from failed contract calls", () => {
    const event = normalizeActivityEvent(
      rawEvent({
        inSuccessfulContractCall: false,
        topic: ["proposal", "created"],
        value: [7, CREATOR, 4_500_000_000n],
      }),
    );
    expect(event).toBeNull();
  });

  it("rejects unknown topics", () => {
    const event = normalizeActivityEvent(
      rawEvent({ topic: ["mystery", "thing"], value: [7] }),
    );
    expect(event).toBeNull();
  });

  it("rejects malformed value shapes", () => {
    expect(
      normalizeActivityEvent(rawEvent({ topic: ["proposal", "created"], value: [7, CREATOR] })),
    ).toBeNull();
    expect(
      normalizeActivityEvent(rawEvent({ topic: ["execute", "paid"], value: [7, RECIPIENT, "nope"] })),
    ).toBeNull();
    expect(
      normalizeActivityEvent(rawEvent({ topic: ["treasury", "created"], value: "not-a-vec" })),
    ).toBeNull();
  });

  it("rejects non-address actor fields", () => {
    const event = normalizeActivityEvent(
      rawEvent({ topic: ["approval", "signed"], value: [7, "not-an-address"] }),
    );
    expect(event).toBeNull();
  });
});

describe("loadWalletActivity", () => {
  it("combines treasury metadata and recent events for a contract", async () => {
    const events: ChainActivityView[] = [
      {
        id: "event-1",
        treasuryContractId: CONTRACT,
        type: "deposit",
        actor: MEMBER_ONE,
        amountBaseUnits: 5_000_000_000n,
        ledger: 1000,
        createdAt: "2026-08-10T00:00:00Z",
        txHash: "a".repeat(64),
      },
    ];
    const rpc = mockRpc({ getRecentEvents: async () => events });
    const result = await loadWalletActivity(rpc, CONTRACT);

    expect(result.treasury?.name).toBe("IT Society Event Fund");
    expect(result.events).toEqual(events);
  });

  it("keeps events when the treasury metadata read fails", async () => {
    const events: ChainActivityView[] = [];
    const rpc = mockRpc({
      getRecentEvents: async () => events,
      getConfig: async () => {
        throw new Error("rpc unavailable");
      },
    });
    const result = await loadWalletActivity(rpc, CONTRACT);

    expect(result.treasury).toBeNull();
    expect(result.events).toEqual([]);
  });
});

describe("stellarCoholdRpc", () => {
  it("is constructible without network configuration", () => {
    const rpc = stellarCoholdRpc();
    expect(typeof rpc.getConfig).toBe("function");
    expect(typeof rpc.getBalance).toBe("function");
    expect(typeof rpc.getProposal).toBe("function");
    expect(typeof rpc.getMemberList).toBe("function");
    expect(typeof rpc.isMember).toBe("function");
    expect(typeof rpc.hasApproved).toBe("function");
    expect(typeof rpc.getTokenInfo).toBe("function");
    expect(typeof rpc.getRecentEvents).toBe("function");
  });

  describe("getRecentEvents recent-tail behavior", () => {
    const TX = "a".repeat(64);

    function approvedEvent(ledger: number) {
      return {
        id: `event-${ledger}`,
        txHash: TX,
        ledger,
        ledgerClosedAt: new Date(2026, 7, 10, 0, 0, ledger % 60).toISOString(),
        inSuccessfulContractCall: true,
        topic: [
          StellarSdk.xdr.ScVal.scvSymbol("proposal"),
          StellarSdk.xdr.ScVal.scvSymbol("approved"),
        ],
        value: StellarSdk.xdr.ScVal.scvVec([
          StellarSdk.xdr.ScVal.scvU32(7),
          StellarSdk.xdr.ScVal.scvU32(2),
        ]),
      };
    }

    function rpcWithTwoPages(total: number) {
      const all = Array.from({ length: total }, (_, i) => approvedEvent(2000 + i));
      const getEvents = vi.fn(async (request: { cursor?: string }) => {
        const from = request.cursor ? Number(request.cursor) : 0;
        const page = all.slice(from, from + 100);
        return { events: page, cursor: String(from + 100) };
      });
      const server = {
        getHealth: async () => ({ oldestLedger: 1000, latestLedger: 3000 }),
        getLatestLedger: async () => ({ sequence: 3000 }),
        getEvents,
      } as unknown as StellarSdk.rpc.Server;
      return {
        rpc: stellarCoholdRpc({ rpcUrl: "https://example.invalid", server }),
        getEvents,
        all,
      };
    }

    it("walks pages and returns only the most recent events", async () => {
      const { rpc, getEvents, all } = rpcWithTwoPages(110);
      const views = await rpc.getRecentEvents(CONTRACT);

      expect(getEvents).toHaveBeenCalledTimes(2);
      expect(views).toHaveLength(100);
      // The tail starts at the 11th event, not the window start.
      expect(views[0].ledger).toBe(all[10].ledger);
      expect(views[99].ledger).toBe(all[109].ledger);
    });

    it("keeps at most 100 events even when pages are full", async () => {
      const { rpc, getEvents, all } = rpcWithTwoPages(200);
      const views = await rpc.getRecentEvents(CONTRACT);

      expect(views).toHaveLength(100);
      expect(views[0].ledger).toBe(all[100].ledger);
      expect(views[99].ledger).toBe(all[199].ledger);
      // Page 1 was full, page 2 was full, so a third fetch confirms the tail.
      expect(getEvents).toHaveBeenCalledTimes(3);
    });
  });

  describe("unusable RPC endpoint", () => {
    // The SDK refuses plain-http endpoints at construction time. A bad URL
    // must fail the health probe and the event read cleanly instead of
    // throwing during component render.
    it("reports unhealthy and rejects event reads without a constructor crash", async () => {
      const rpc = stellarCoholdRpc({ rpcUrl: "http://127.0.0.1:59999" });

      await expect(rpc.getHealth()).resolves.toBe(false);
      await expect(rpc.getRecentEvents(CONTRACT)).rejects.toThrow(
        "Stellar RPC is unavailable",
      );
      await expect(rpc.getConfig(CONTRACT)).rejects.toThrow(
        "could not be read from Stellar RPC",
      );
    });
  });
});