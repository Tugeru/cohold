import { describe, expect, it, vi, beforeEach } from "vitest";
import { Err, Ok } from "@stellar/stellar-sdk/contract";
import {
  stellarCoholdRpc,
  type ChainProposalRecord,
  type ChainTreasuryConfig,
} from "./contract-adapter";

// stellarCoholdRpc reads treasury state through the generated bindings
// Client; mock the package so the tests observe the exact calls and prove
// the SDK Result shapes flow through the existing normalizers.
const state = vi.hoisted(() => ({
  instances: [] as Array<{ contractId: string }>,
  throws: {} as Record<string, boolean>,
  config: null as unknown,
  members: null as unknown,
  count: null as unknown,
  proposal: null as unknown,
}));

vi.mock("cohold-contract", () => {
  class Client {
    readonly contractId: string;
    constructor(options: { contractId: string }) {
      this.contractId = options.contractId;
      state.instances.push(options);
    }
    async get_config() {
      if (state.throws.get_config) throw new Error("rpc unavailable");
      return { result: state.config };
    }
    async get_members() {
      if (state.throws.get_members) throw new Error("rpc unavailable");
      return { result: state.members };
    }
    async get_proposal_count() {
      if (state.throws.get_proposal_count) throw new Error("rpc unavailable");
      return { result: state.count };
    }
    async get_proposal() {
      if (state.throws.get_proposal) throw new Error("rpc unavailable");
      return { result: state.proposal };
    }
  }
  return { Client };
});

const CONTRACT = `C${"A".repeat(55)}`;
const TOKEN = `C${"B".repeat(55)}`;
const MEMBER_ONE = `G${"A".repeat(55)}`;
const MEMBER_TWO = `G${"B".repeat(55)}`;
const RECIPIENT = `G${"C".repeat(55)}`;

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
  recipient: RECIPIENT,
  amount: 4_500_000_000n,
  description: "Venue deposit",
  approvalCount: 2,
  status: "approved",
  createdAt: 1_750_000_000,
};

beforeEach(() => {
  state.instances.length = 0;
  state.throws = {};
  state.config = null;
  state.members = null;
  state.count = null;
  state.proposal = null;
});

describe("stellarCoholdRpc bindings reads", () => {
  it("reads the member list through client.get_members and normalizes it", async () => {
    state.members = [MEMBER_ONE, MEMBER_TWO, "not-an-address"];

    const rpc = stellarCoholdRpc({ rpcUrl: "https://example.invalid" });
    await expect(rpc.getMemberList(CONTRACT)).resolves.toEqual([
      MEMBER_ONE,
      MEMBER_TWO,
    ]);
    expect(state.instances).toHaveLength(1);
    expect(state.instances[0].contractId).toBe(CONTRACT);
  });

  it("returns null when the member list read fails", async () => {
    state.throws.get_members = true;
    const rpc = stellarCoholdRpc({ rpcUrl: "https://example.invalid" });
    await expect(rpc.getMemberList(CONTRACT)).resolves.toBeNull();
  });

  it("reads the proposal count through client.get_proposal_count", async () => {
    state.count = 3n;
    const rpc = stellarCoholdRpc({ rpcUrl: "https://example.invalid" });
    await expect(rpc.getProposalCount(CONTRACT)).resolves.toBe(3);
  });

  it("returns null when the proposal count read fails", async () => {
    state.throws.get_proposal_count = true;
    const rpc = stellarCoholdRpc({ rpcUrl: "https://example.invalid" });
    await expect(rpc.getProposalCount(CONTRACT)).resolves.toBeNull();
  });

  it("normalizes the generated Result<TreasuryConfig> into the config view", async () => {
    state.config = new Ok({
      creator: MEMBER_ONE,
      token: TOKEN,
      threshold: 2,
      member_count: 3,
      name: "IT Society Event Fund",
    });
    const rpc = stellarCoholdRpc({ rpcUrl: "https://example.invalid" });
    await expect(rpc.getConfig(CONTRACT)).resolves.toEqual(config);
  });

  it("treats a rejected get_config as an uninitialized treasury", async () => {
    state.config = new Err({ message: "no data" });
    const rpc = stellarCoholdRpc({ rpcUrl: "https://example.invalid" });
    await expect(rpc.getConfig(CONTRACT)).resolves.toBeNull();
  });

  it("normalizes the generated Result<Proposal> into the record view", async () => {
    state.proposal = new Ok({
      id: 7n,
      proposer: MEMBER_ONE,
      recipient: RECIPIENT,
      amount: 4_500_000_000n,
      description: "Venue deposit",
      approval_count: 2,
      status: 1,
      created_at: 1_750_000_000n,
    });
    const rpc = stellarCoholdRpc({ rpcUrl: "https://example.invalid" });
    await expect(rpc.getProposal(CONTRACT, 7)).resolves.toEqual(record);
  });

  it("returns null for a rejected get_proposal instead of throwing", async () => {
    state.proposal = new Err({ message: "no data" });
    const rpc = stellarCoholdRpc({ rpcUrl: "https://example.invalid" });
    await expect(rpc.getProposal(CONTRACT, 99)).resolves.toBeNull();
  });
});