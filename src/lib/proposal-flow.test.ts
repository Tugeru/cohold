import { describe, expect, it, vi, beforeEach } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { Err, Ok } from "@stellar/stellar-sdk/contract";
import {
  approveFlow,
  createProposalFlow,
  executeFlow,
  stellarProposalExecutor,
  type ApproveFlowDeps,
  type CreateProposalFlowDeps,
  type ExecuteFlowDeps,
  type ProposalExecutor,
} from "./proposal-flow";
import type { ChainProposalStatus } from "./contract-adapter";
import type { WalletSignatureResult } from "./wallet-adapter";

// The SDK executor constructs the generated bindings `Client`; mock the
// package so the binding-level tests observe the exact invocations without
// touching a network.
const binding = vi.hoisted(() => ({
  create_proposal: vi.fn(),
  approve: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("cohold-contract", () => {
  class Client {
    constructor(readonly options: Record<string, unknown>) {}
    create_proposal(args: unknown) {
      return binding.create_proposal(args);
    }
    approve(args: unknown) {
      return binding.approve(args);
    }
    execute(args: unknown) {
      return binding.execute(args);
    }
  }
  return { Client };
});

beforeEach(() => {
  binding.create_proposal.mockReset();
  binding.approve.mockReset();
  binding.execute.mockReset();
});

const CONTRACT = `C${"A".repeat(55)}`;
const TOKEN = `C${"B".repeat(55)}`;
const MEMBER = `G${"A".repeat(55)}`;
const RECIPIENT = `G${"B".repeat(55)}`;
const XDR = "AAAAAgAAAABzaW1wbGVkLXRyYW5zYWN0aW9u";

interface FakeExecutorCalls {
  create: Array<{
    contractId: string;
    proposerAddress: string;
    recipient: string;
    amountBaseUnits: bigint;
    description: string;
  }>;
  approve: Array<{ contractId: string; memberAddress: string; proposalId: number }>;
  execute: Array<{ contractId: string; callerAddress: string; proposalId: number }>;
  submit: string[];
  confirm: string[];
}

interface FakeExecutor extends ProposalExecutor {
  calls: FakeExecutorCalls;
}

function fakeExecutor(overrides: {
  create?: () => Promise<{ preparedTxXdr: string; previewProposalId: bigint | null }>;
  approve?: () => Promise<{ preparedTxXdr: string }>;
  execute?: () => Promise<{ preparedTxXdr: string }>;
  submit?: () => Promise<{ hash: string }>;
  confirm?: () => Promise<"success" | "failed" | "pending">;
} = {}): FakeExecutor {
  const calls: FakeExecutorCalls = { create: [], approve: [], execute: [], submit: [], confirm: [] };
  return {
    calls,
    async simulateCreateProposal(input) {
      calls.create.push(input);
      if (overrides.create) return overrides.create();
      return { preparedTxXdr: XDR, previewProposalId: 1n };
    },
    async simulateApprove(input) {
      calls.approve.push(input);
      if (overrides.approve) return overrides.approve();
      return { preparedTxXdr: XDR };
    },
    async simulateExecute(input) {
      calls.execute.push(input);
      if (overrides.execute) return overrides.execute();
      return { preparedTxXdr: XDR };
    },
    async submitInvocation(signedTxXdr) {
      calls.submit.push(signedTxXdr);
      if (overrides.submit) return overrides.submit();
      return { hash: "abc123hash" };
    },
    async confirmInvocation(hash) {
      calls.confirm.push(hash);
      if (overrides.confirm) return overrides.confirm();
      return "success";
    },
  };
}

function fakeSigner(
  result: WalletSignatureResult | ((xdr: string) => Promise<WalletSignatureResult>),
) {
  return vi.fn(async (xdr: string) => {
    if (typeof result === "function") return result(xdr);
    return result;
  });
}

function signedResult(xdr = "signed-xdr"): WalletSignatureResult {
  return { status: "signed", signedTxXdr: xdr, signerAddress: MEMBER };
}

function buildCreateDeps(overrides: Partial<CreateProposalFlowDeps> = {}): {
  executor: FakeExecutor;
  deps: CreateProposalFlowDeps;
} {
  const executor = fakeExecutor();
  const deps: CreateProposalFlowDeps = {
    executor,
    contractId: CONTRACT,
    treasuryName: "Barkada Fund",
    memberAddress: MEMBER,
    asset: { contractId: TOKEN, symbol: "USDC", decimals: 7 },
    treasuryBalanceBaseUnits: "10000000000",
    isMember: vi.fn(async () => true),
    readProposal: vi.fn(async (id: number) => ({
      proposalId: id,
      proposer: MEMBER,
      approvalCount: 1,
      status: "pending" as ChainProposalStatus,
    })),
    readLatestProposalId: vi.fn(async () => 1),
    signTransaction: fakeSigner(signedResult()),
    ...overrides,
  };
  return { executor, deps };
}

function buildApproveDeps(overrides: Partial<ApproveFlowDeps> = {}): {
  executor: FakeExecutor;
  deps: ApproveFlowDeps;
} {
  const executor = fakeExecutor();
  const deps: ApproveFlowDeps = {
    executor,
    contractId: CONTRACT,
    treasuryName: "Barkada Fund",
    memberAddress: MEMBER,
    proposalId: 1,
    reviewed: {
      amountBaseUnits: "250000000",
      recipient: RECIPIENT,
      description: "Venue deposit",
      assetSymbol: "USDC",
      assetDecimals: 7,
      approvalCount: 1,
      threshold: 2,
    },
    isMember: vi.fn(async () => true),
    readProposal: vi.fn(async () => ({
      proposalId: 1,
      proposer: MEMBER,
      approvalCount: 2,
      status: "approved" as ChainProposalStatus,
    })),
    signTransaction: fakeSigner(signedResult()),
    ...overrides,
  };
  return { executor, deps };
}

function buildExecuteDeps(overrides: Partial<ExecuteFlowDeps> = {}): {
  executor: FakeExecutor;
  deps: ExecuteFlowDeps;
} {
  const executor = fakeExecutor();
  const deps: ExecuteFlowDeps = {
    executor,
    contractId: CONTRACT,
    treasuryName: "Barkada Fund",
    callerAddress: MEMBER,
    proposalId: 1,
    reviewed: {
      status: "approved" as ChainProposalStatus,
      amountBaseUnits: "250000000",
      recipient: RECIPIENT,
      description: "Venue deposit",
      assetContractId: TOKEN,
      assetSymbol: "USDC",
      assetDecimals: 7,
      approvalCount: 2,
      threshold: 2,
      treasuryBalanceBaseUnits: "10000000000",
    },
    readProposal: vi.fn(async () => ({
      approvalCount: 2,
      status: "approved" as ChainProposalStatus,
    })),
    readBalance: vi.fn(async () => 10_000_000_000n),
    signTransaction: fakeSigner(signedResult()),
    ...overrides,
  };
  return { executor, deps };
}

describe("createProposalFlow.prepare", () => {
  it("rejects zero, negative, fractional, and malformed amounts before any chain call", async () => {
    const { executor, deps } = buildCreateDeps();
    const flow = createProposalFlow(deps);
    for (const bad of ["0", "-1", "1.5", "abc", "  ", 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      const outcome = await flow.prepare({
        amountBaseUnits: bad,
        recipient: RECIPIENT,
        description: "Venue deposit",
      });
      expect(outcome.status).toBe("invalid-amount");
    }
    expect(executor.calls.create).toHaveLength(0);
    expect(deps.isMember).not.toHaveBeenCalled();
  });

  it("rejects malformed recipients before any chain call", async () => {
    const { executor, deps } = buildCreateDeps();
    const flow = createProposalFlow(deps);
    for (const recipient of ["", "nonsense", "G" + "A".repeat(54), `G${"A".repeat(56)}`]) {
      const outcome = await flow.prepare({
        amountBaseUnits: "5000000",
        recipient,
        description: "Venue deposit",
      });
      expect(outcome.status).toBe("invalid-recipient");
    }
    expect(executor.calls.create).toHaveLength(0);
    expect(deps.isMember).not.toHaveBeenCalled();
  });

  it("rejects blank descriptions before any chain call", async () => {
    const { executor, deps } = buildCreateDeps();
    const flow = createProposalFlow(deps);
    for (const description of ["", "   "]) {
      const outcome = await flow.prepare({
        amountBaseUnits: "5000000",
        recipient: RECIPIENT,
        description,
      });
      expect(outcome.status).toBe("invalid-description");
    }
    expect(executor.calls.create).toHaveLength(0);
    expect(deps.isMember).not.toHaveBeenCalled();
  });

  it("maps a non-member to a product error and never simulates", async () => {
    const { executor, deps } = buildCreateDeps({
      isMember: vi.fn(async () => false),
    });
    const outcome = await createProposalFlow(deps).prepare({
      amountBaseUnits: "5000000",
      recipient: RECIPIENT,
      description: "Venue deposit",
    });
    expect(outcome.status).toBe("not-member");
    if (outcome.status === "not-member") {
      expect(outcome.error.kind).toBe("not-member");
      expect(outcome.error.message).toMatch(/members/i);
    }
    expect(executor.calls.create).toHaveLength(0);
  });

  it("maps an unreadable membership check to a product error", async () => {
    const { executor, deps } = buildCreateDeps({
      isMember: vi.fn(async () => {
        throw new Error("rpc down");
      }),
    });
    const outcome = await createProposalFlow(deps).prepare({
      amountBaseUnits: "5000000",
      recipient: RECIPIENT,
      description: "Venue deposit",
    });
    expect(outcome.status).toBe("simulation-failed");
    expect(executor.calls.create).toHaveLength(0);
  });

  it("prevents signing when simulation fails", async () => {
    const { executor, deps } = buildCreateDeps({
      executor: fakeExecutor({
        create: async () => {
          throw new Error("HostError");
        },
      }),
    });
    const outcome = await createProposalFlow(deps).prepare({
      amountBaseUnits: "5000000",
      recipient: RECIPIENT,
      description: "Venue deposit",
    });
    expect(outcome.status).toBe("simulation-failed");
    if (outcome.status === "simulation-failed") {
      expect(outcome.error.message).toMatch(/no proposal/i);
    }
    expect(deps.signTransaction).not.toHaveBeenCalled();
    expect(executor.calls.submit).toHaveLength(0);
  });

  it("maps a simulated NotMember host error (SDK path) to a product error", async () => {
    const { deps } = buildCreateDeps({
      executor: fakeExecutor({
        create: async () => {
          throw new Error("Error(Contract, #3)");
        },
      }),
    });
    const outcome = await createProposalFlow(deps).prepare({
      amountBaseUnits: "5000000",
      recipient: RECIPIENT,
      description: "Venue deposit",
    });
    expect(outcome.status).toBe("not-member");
  });

  it("passes only the configured contract, wallet proposer, and reviewed fields to simulation", async () => {
    const { executor, deps } = buildCreateDeps();
    const outcome = await createProposalFlow(deps).prepare({
      amountBaseUnits: "250000000",
      recipient: RECIPIENT,
      description: "  Venue deposit  ",
    });
    expect(outcome.status).toBe("ready");
    expect(executor.calls.create).toEqual([
      {
        contractId: CONTRACT,
        proposerAddress: MEMBER,
        recipient: RECIPIENT,
        amountBaseUnits: 250_000_000n,
        description: "Venue deposit",
      },
    ]);
  });

  it("returns a review with exact reviewed fields, configured asset, and treasury", async () => {
    const { deps } = buildCreateDeps();
    const outcome = await createProposalFlow(deps).prepare({
      amountBaseUnits: "250000000",
      recipient: RECIPIENT,
      description: "Venue deposit",
    });
    expect(outcome.status).toBe("ready");
    if (outcome.status === "ready") {
      expect(outcome.review).toEqual({
        treasuryId: CONTRACT,
        treasuryName: "Barkada Fund",
        proposerAddress: MEMBER,
        amountBaseUnits: "250000000",
        recipient: RECIPIENT,
        description: "Venue deposit",
        assetContractId: TOKEN,
        assetSymbol: "USDC",
        assetDecimals: 7,
        treasuryBalanceBaseUnits: "10000000000",
      });
      expect(outcome.preparedTxXdr).toBe(XDR);
    }
  });

  it("exposes the simulated proposal id for post-confirmation re-reads", async () => {
    const { deps } = buildCreateDeps({
      executor: fakeExecutor({
        create: async () => ({ preparedTxXdr: XDR, previewProposalId: 7n }),
      }),
    });
    const outcome = await createProposalFlow(deps).prepare({
      amountBaseUnits: "5000000",
      recipient: RECIPIENT,
      description: "Venue deposit",
    });
    expect(outcome.status).toBe("ready");
    if (outcome.status === "ready") {
      expect(outcome.previewProposalId).toBe(7);
    }
  });
});

describe("approveFlow.prepare", () => {
  it("blocks a non-member before simulation with a product error", async () => {
    const { executor, deps } = buildApproveDeps({
      isMember: vi.fn(async () => false),
    });
    const outcome = await approveFlow(deps).prepare();
    expect(outcome.status).toBe("not-member");
    if (outcome.status === "not-member") {
      expect(outcome.error.message).toMatch(/members/i);
    }
    expect(executor.calls.approve).toHaveLength(0);
  });

  it("maps a simulated AlreadyApproved host error to a product error and never signs", async () => {
    const { executor, deps } = buildApproveDeps({
      executor: fakeExecutor({
        approve: async () => {
          throw new Error("Error(Contract, #8)");
        },
      }),
    });
    const outcome = await approveFlow(deps).prepare();
    expect(outcome.status).toBe("already-approved");
    if (outcome.status === "already-approved") {
      expect(outcome.error.kind).toBe("already-approved");
      expect(outcome.error.message).toMatch(/already approved/i);
    }
    expect(deps.signTransaction).not.toHaveBeenCalled();
    expect(executor.calls.submit).toHaveLength(0);
  });

  it("maps a simulated ProposalNotPending host error to a product error", async () => {
    const { deps } = buildApproveDeps({
      executor: fakeExecutor({
        approve: async () => {
          throw new Error("Error(Contract, #10)");
        },
      }),
    });
    const outcome = await approveFlow(deps).prepare();
    expect(outcome.status).toBe("proposal-not-pending");
  });

  it("maps a simulated ProposalNotFound host error to a product error", async () => {
    const { deps } = buildApproveDeps({
      executor: fakeExecutor({
        approve: async () => {
          throw new Error("Error(Contract, #9)");
        },
      }),
    });
    const outcome = await approveFlow(deps).prepare();
    expect(outcome.status).toBe("proposal-not-found");
  });

  it("maps an unreadable membership check to a product error", async () => {
    const { executor, deps } = buildApproveDeps({
      isMember: vi.fn(async () => {
        throw new Error("rpc down");
      }),
    });
    const outcome = await approveFlow(deps).prepare();
    expect(outcome.status).toBe("simulation-failed");
    expect(executor.calls.approve).toHaveLength(0);
  });

  it("passes only the configured contract, wallet member, and proposal id to simulation", async () => {
    const { executor, deps } = buildApproveDeps();
    const outcome = await approveFlow(deps).prepare();
    expect(outcome.status).toBe("ready");
    expect(executor.calls.approve).toEqual([
      { contractId: CONTRACT, memberAddress: MEMBER, proposalId: 1 },
    ]);
  });

  it("builds the review from the chain-backed proposal facts, never from request input", async () => {
    const { deps } = buildApproveDeps();
    const outcome = await approveFlow(deps).prepare();
    expect(outcome.status).toBe("ready");
    if (outcome.status === "ready") {
      expect(outcome.review).toEqual({
        treasuryId: CONTRACT,
        treasuryName: "Barkada Fund",
        memberAddress: MEMBER,
        proposalId: 1,
        amountBaseUnits: "250000000",
        recipient: RECIPIENT,
        description: "Venue deposit",
        assetSymbol: "USDC",
        assetDecimals: 7,
        approvalCount: 1,
        threshold: 2,
      });
    }
  });
});

describe("executeFlow.prepare", () => {
  it("rejects under-approved execution before any chain call and names approvals still required", async () => {
    const { executor, deps } = buildExecuteDeps({
      reviewed: {
        status: "pending" as ChainProposalStatus,
        amountBaseUnits: "250000000",
        recipient: RECIPIENT,
        description: "Venue deposit",
        assetContractId: TOKEN,
        assetSymbol: "USDC",
        assetDecimals: 7,
        approvalCount: 1,
        threshold: 3,
        treasuryBalanceBaseUnits: "10000000000",
      },
    });
    const outcome = await executeFlow(deps).prepare();
    expect(outcome.status).toBe("proposal-not-approved");
    if (outcome.status === "proposal-not-approved") {
      expect(outcome.error.kind).toBe("proposal-not-approved");
      expect(outcome.error.message).toMatch(/2 more approvals/i);
    }
    expect(executor.calls.execute).toHaveLength(0);
    expect(deps.signTransaction).not.toHaveBeenCalled();
  });

  it("rejects an already executed proposal before any signing", async () => {
    const { executor, deps } = buildExecuteDeps({
      reviewed: {
        status: "executed" as ChainProposalStatus,
        amountBaseUnits: "250000000",
        recipient: RECIPIENT,
        description: "Venue deposit",
        assetContractId: TOKEN,
        assetSymbol: "USDC",
        assetDecimals: 7,
        approvalCount: 2,
        threshold: 2,
        treasuryBalanceBaseUnits: "7500000000",
      },
    });
    const outcome = await executeFlow(deps).prepare();
    expect(outcome.status).toBe("already-executed");
    if (outcome.status === "already-executed") {
      expect(outcome.error.kind).toBe("already-executed");
      expect(outcome.error.message).toMatch(/has already been executed/i);
    }
    expect(executor.calls.execute).toHaveLength(0);
    expect(deps.signTransaction).not.toHaveBeenCalled();
  });

  it("rejects insufficient balance without signing and reports required vs available", async () => {
    const { executor, deps } = buildExecuteDeps({
      reviewed: {
        status: "approved" as ChainProposalStatus,
        amountBaseUnits: "250000000",
        recipient: RECIPIENT,
        description: "Venue deposit",
        assetContractId: TOKEN,
        assetSymbol: "USDC",
        assetDecimals: 7,
        approvalCount: 2,
        threshold: 2,
        treasuryBalanceBaseUnits: "100000000",
      },
    });
    const outcome = await executeFlow(deps).prepare();
    expect(outcome.status).toBe("insufficient-balance");
    if (outcome.status === "insufficient-balance") {
      expect(outcome.error.kind).toBe("insufficient-balance");
      expect(outcome.error.message).toMatch(/available/i);
      expect(outcome.error.message).toMatch(/required/i);
    }
    expect(executor.calls.execute).toHaveLength(0);
    expect(deps.signTransaction).not.toHaveBeenCalled();
  });

  it("passes only the configured contract, caller, and proposal id to simulation", async () => {
    const { executor, deps } = buildExecuteDeps();
    const outcome = await executeFlow(deps).prepare();
    expect(outcome.status).toBe("ready");
    expect(executor.calls.execute).toEqual([
      { contractId: CONTRACT, callerAddress: MEMBER, proposalId: 1 },
    ]);
  });

  it("returns a review with exact amount, asset, source treasury, recipient, and threshold progress", async () => {
    const { deps } = buildExecuteDeps();
    const outcome = await executeFlow(deps).prepare();
    expect(outcome.status).toBe("ready");
    if (outcome.status === "ready") {
      expect(outcome.review).toEqual({
        treasuryId: CONTRACT,
        treasuryName: "Barkada Fund",
        callerAddress: MEMBER,
        proposalId: 1,
        status: "approved",
        amountBaseUnits: "250000000",
        recipient: RECIPIENT,
        description: "Venue deposit",
        assetContractId: TOKEN,
        assetSymbol: "USDC",
        assetDecimals: 7,
        approvalCount: 2,
        threshold: 2,
        treasuryBalanceBaseUnits: "10000000000",
      });
      expect(outcome.preparedTxXdr).toBe(XDR);
    }
  });
});

describe("proposal flows signAndSend", () => {
  it("signs with the prepared transaction XDR and returns the submitted hash", async () => {
    const { executor, deps } = buildCreateDeps();
    const outcome = await createProposalFlow(deps).signAndSend(XDR);
    expect(outcome).toEqual({ status: "submitted", hash: "abc123hash" });
    expect(deps.signTransaction).toHaveBeenCalledWith(XDR);
    expect(executor.calls.submit).toEqual(["signed-xdr"]);
  });

  it("submits a pre-signed XDR without asking the wallet again", async () => {
    const { executor, deps } = buildCreateDeps();
    const outcome = await createProposalFlow(deps).signAndSend(XDR, "signed-already");
    expect(outcome).toEqual({ status: "submitted", hash: "abc123hash" });
    expect(deps.signTransaction).not.toHaveBeenCalled();
    expect(executor.calls.submit).toEqual(["signed-already"]);
  });

  it("maps wallet rejection to a product error and never submits", async () => {
    const { executor, deps } = buildApproveDeps({
      signTransaction: fakeSigner({ status: "cancelled", message: "nope" }),
    });
    const outcome = await approveFlow(deps).signAndSend(XDR);
    expect(outcome.status).toBe("sign-failed");
    if (outcome.status === "sign-failed") {
      expect(outcome.error.kind).toBe("wallet-rejected");
    }
    expect(executor.calls.submit).toHaveLength(0);
  });

  it("maps wrong-network signing to a product error and never submits", async () => {
    const { executor, deps } = buildCreateDeps({
      signTransaction: fakeSigner({
        status: "wrong-network",
        network: "mainnet",
        networkPassphrase: "mainnet-passphrase",
      }),
    });
    const outcome = await createProposalFlow(deps).signAndSend(XDR);
    expect(outcome.status).toBe("sign-failed");
    if (outcome.status === "sign-failed") {
      expect(outcome.error.kind).toBe("wallet-network");
      expect(outcome.error.message).toMatch(/testnet/i);
    }
    expect(executor.calls.submit).toHaveLength(0);
  });

  it("maps a disconnected wallet to a product error and never submits", async () => {
    const { executor, deps } = buildCreateDeps({
      signTransaction: fakeSigner({ status: "not-connected", message: "Connect Freighter" }),
    });
    const outcome = await createProposalFlow(deps).signAndSend(XDR);
    expect(outcome.status).toBe("sign-failed");
    if (outcome.status === "sign-failed") {
      expect(outcome.error.kind).toBe("wallet-unavailable");
    }
    expect(executor.calls.submit).toHaveLength(0);
  });

  it("signs execute transactions with the prepared transaction XDR and returns the submitted hash", async () => {
    const { executor, deps } = buildExecuteDeps();
    const outcome = await executeFlow(deps).signAndSend(XDR);
    expect(outcome).toEqual({ status: "submitted", hash: "abc123hash" });
    expect(deps.signTransaction).toHaveBeenCalledWith(XDR);
    expect(executor.calls.submit).toEqual(["signed-xdr"]);
  });

  it("maps submission rejection to a product error", async () => {
    const { deps } = buildCreateDeps({
      executor: fakeExecutor({
        submit: async () => {
          throw new Error("TX_INSUFFICIENT_FEE");
        },
      }),
    });
    const outcome = await createProposalFlow(deps).signAndSend(XDR);
    expect(outcome.status).toBe("send-failed");
    if (outcome.status === "send-failed") {
      expect(outcome.error.kind).toBe("send-failed");
    }
  });

  it("carries the transaction hash when submission rejects with one", async () => {
    const { deps } = buildCreateDeps({
      executor: fakeExecutor({
        submit: async () => {
          throw Object.assign(new Error("Testnet rejected the transaction"), {
            hash: "race-hash-1",
          });
        },
      }),
    });
    const outcome = await createProposalFlow(deps).signAndSend(XDR);
    expect(outcome.status).toBe("send-failed");
    if (outcome.status === "send-failed") {
      expect(outcome.error.hash).toBe("race-hash-1");
    }
  });
});

describe("createProposalFlow.confirm", () => {
  it("reports success only after confirmation and a re-read of the created proposal", async () => {
    const { deps } = buildCreateDeps();
    const outcome = await createProposalFlow(deps).confirm("hash1", 1);
    expect(outcome).toEqual({
      status: "confirmed",
      hash: "hash1",
      proposalId: 1,
      approvalCount: 1,
      proposalStatus: "pending",
    });
    expect(deps.readProposal).toHaveBeenCalledWith(1);
  });

  it("falls back to the latest proposal when the preview id is missing", async () => {
    const { deps } = buildCreateDeps({
      readLatestProposalId: vi.fn(async () => 3),
    });
    const outcome = await createProposalFlow(deps).confirm("hash1", null);
    expect(outcome.status).toBe("confirmed");
    if (outcome.status === "confirmed") {
      expect(outcome.proposalId).toBe(3);
    }
  });

  it("never claims another member's latest proposal as the created one", async () => {
    const { deps } = buildCreateDeps({
      readProposal: vi.fn(async () => ({
        proposalId: 1,
        proposer: `G${"C".repeat(55)}`,
        approvalCount: 1,
        status: "pending" as ChainProposalStatus,
      })),
    });
    const outcome = await createProposalFlow(deps).confirm("hash1", 1);
    expect(outcome.status).toBe("confirmed");
    if (outcome.status === "confirmed") {
      expect(outcome.proposalId).toBeNull();
      expect(outcome.approvalCount).toBeNull();
    }
  });

  it("claims the created proposal only when chain facts match the prepared review", async () => {
    const { deps } = buildCreateDeps({
      readProposal: vi.fn(async () => ({
        proposalId: 1,
        proposer: MEMBER,
        approvalCount: 1,
        status: "pending" as ChainProposalStatus,
        amountBaseUnits: "100000000",
        recipient: RECIPIENT,
      })),
    });
    const flow = createProposalFlow(deps);
    await flow.prepare({
      amountBaseUnits: "100000000",
      recipient: RECIPIENT,
      description: "Spend",
    });
    const outcome = await flow.confirm("hash1", 1);
    expect(outcome.status).toBe("confirmed");
    if (outcome.status === "confirmed") {
      expect(outcome.proposalId).toBe(1);
    }
  });

  it("never claims a same-proposer proposal whose facts differ from the review", async () => {
    const { deps } = buildCreateDeps({
      readProposal: vi.fn(async () => ({
        proposalId: 2,
        proposer: MEMBER,
        approvalCount: 1,
        status: "pending" as ChainProposalStatus,
        amountBaseUnits: "50000000",
        recipient: RECIPIENT,
      })),
    });
    const flow = createProposalFlow(deps);
    await flow.prepare({
      amountBaseUnits: "100000000",
      recipient: RECIPIENT,
      description: "Spend",
    });
    const outcome = await flow.confirm("hash1", 2);
    expect(outcome.status).toBe("confirmed");
    if (outcome.status === "confirmed") {
      expect(outcome.proposalId).toBeNull();
      expect(outcome.approvalCount).toBeNull();
    }
  });

  it("shows a stale confirmed state when the proposal cannot be re-read", async () => {
    const { deps } = buildCreateDeps({
      readProposal: vi.fn(async () => null),
      readLatestProposalId: vi.fn(async () => null),
    });
    const outcome = await createProposalFlow(deps).confirm("hash1", 1);
    expect(outcome.status).toBe("confirmed");
    if (outcome.status === "confirmed") {
      expect(outcome.proposalId).toBeNull();
      expect(outcome.approvalCount).toBeNull();
      expect(outcome.proposalStatus).toBeNull();
    }
  });

  it("treats a throwing re-read as stale, never an invented state", async () => {
    const { deps } = buildCreateDeps({
      readProposal: vi.fn(async () => {
        throw new Error("rpc down");
      }),
    });
    const outcome = await createProposalFlow(deps).confirm("hash1", 1);
    expect(outcome).toEqual({
      status: "confirmed",
      hash: "hash1",
      proposalId: null,
      approvalCount: null,
      proposalStatus: null,
    });
  });

  it("keeps a still-pending confirmation retryable with the hash", async () => {
    const { deps } = buildCreateDeps({
      executor: fakeExecutor({ confirm: async () => "pending" }),
    });
    const outcome = await createProposalFlow(deps).confirm("hashslow", 1);
    expect(outcome).toEqual({ status: "confirmation-pending", hash: "hashslow" });
    expect(deps.readProposal).not.toHaveBeenCalled();
  });

  it("maps a FAILED confirmation to a product error with the hash", async () => {
    const { deps } = buildCreateDeps({
      executor: fakeExecutor({ confirm: async () => "failed" }),
    });
    const outcome = await createProposalFlow(deps).confirm("hashbad", 1);
    expect(outcome.status).toBe("failed");
    if (outcome.status === "failed") {
      expect(outcome.hash).toBe("hashbad");
      expect(outcome.error.kind).toBe("transaction-failed");
      expect(outcome.error.message).toMatch(/no proposal/i);
    }
  });

});

describe("executeFlow.confirm", () => {
  it("reports execute success only after RPC success and fresh proposal and treasury reads", async () => {
    const readProposal = vi.fn(async () => ({ approvalCount: 2, status: "executed" as ChainProposalStatus }));
    const readBalance = vi.fn(async () => 9_750_000_000n);
    const { deps } = buildExecuteDeps({ readProposal, readBalance });
    const outcome = await executeFlow(deps).confirm("hash1");
    expect(outcome).toEqual({
      status: "confirmed",
      hash: "hash1",
      approvalCount: 2,
      proposalStatus: "executed",
      treasuryBalanceBaseUnits: "9750000000",
    });
    expect(readProposal).toHaveBeenCalledWith(1);
    expect(readBalance).toHaveBeenCalledTimes(1);
  });

  it("keeps execute confirmation pending when a fresh read is unavailable", async () => {
    const { deps } = buildExecuteDeps({
      readProposal: vi.fn(async () => null),
      readBalance: vi.fn(async () => null),
    });
    const outcome = await executeFlow(deps).confirm("hashslow");
    expect(outcome).toEqual({ status: "confirmation-pending", hash: "hashslow" });
  });

  it("keeps execute confirmation pending when the fresh proposal is not executed yet", async () => {
    const { deps } = buildExecuteDeps({
      readProposal: vi.fn(async () => ({ approvalCount: 2, status: "approved" as ChainProposalStatus })),
    });
    const outcome = await executeFlow(deps).confirm("hashstale");
    expect(outcome).toEqual({ status: "confirmation-pending", hash: "hashstale" });
  });

  it("keeps an execute confirmation pending with the hash", async () => {
    const { deps } = buildExecuteDeps({
      executor: fakeExecutor({ confirm: async () => "pending" }),
    });
    const outcome = await executeFlow(deps).confirm("hashslow");
    expect(outcome).toEqual({ status: "confirmation-pending", hash: "hashslow" });
  });
});

describe("approveFlow.confirm", () => {
  it("reports success only after confirmation and a re-read of the proposal", async () => {
    const { deps } = buildApproveDeps();
    const outcome = await approveFlow(deps).confirm("hash1");
    expect(outcome).toEqual({
      status: "confirmed",
      hash: "hash1",
      approvalCount: 2,
      proposalStatus: "approved",
    });
    expect(deps.readProposal).toHaveBeenCalledWith(1);
  });

  it("shows a stale confirmed state when the re-read fails", async () => {
    const { deps } = buildApproveDeps({
      readProposal: vi.fn(async () => null),
    });
    const outcome = await approveFlow(deps).confirm("hash1");
    expect(outcome).toEqual({
      status: "confirmed",
      hash: "hash1",
      approvalCount: null,
      proposalStatus: null,
    });
  });

  it("maps a FAILED confirmation to a product error with the hash", async () => {
    const { deps } = buildApproveDeps({
      executor: fakeExecutor({ confirm: async () => "failed" }),
    });
    const outcome = await approveFlow(deps).confirm("hashbad");
    expect(outcome.status).toBe("failed");
    if (outcome.status === "failed") {
      expect(outcome.hash).toBe("hashbad");
      expect(outcome.error.message).toMatch(/no approval/i);
    }
    expect(deps.readProposal).not.toHaveBeenCalled();
  });
});

describe("stellarProposalExecutor", () => {
  it("is constructible without network configuration and exposes the full seam", () => {
    const executor = stellarProposalExecutor();
    expect(typeof executor.simulateCreateProposal).toBe("function");
    expect(typeof executor.simulateApprove).toBe("function");
    expect(typeof executor.simulateExecute).toBe("function");
    expect(typeof executor.submitInvocation).toBe("function");
    expect(typeof executor.confirmInvocation).toBe("function");
  });

  it("preserves Soroban Result error discriminants from SDK simulation output", async () => {
    const result = new Err({
      message: StellarSdk.xdr.ScError.sceContract(7).toXDR("base64"),
    });
    const assembled = {
      simulation: undefined,
      result,
      needsNonInvokerSigningBy: () => [] as string[],
      toXDR: () => XDR,
    };
    binding.execute.mockResolvedValue(assembled);

    await expect(
      stellarProposalExecutor().simulateExecute({
        contractId: CONTRACT,
        callerAddress: MEMBER,
        proposalId: 1,
      }),
    ).rejects.toThrow("Error(Contract, #7)");
  });

  it("invokes the generated client for every executor operation", async () => {
    const executor = stellarProposalExecutor();
    const assembled = {
      simulation: undefined,
      result: undefined,
      needsNonInvokerSigningBy: () => [] as string[],
      toXDR: () => XDR,
    };

    binding.create_proposal.mockResolvedValue({
      ...assembled,
      result: new Ok(3n),
    });
    const created = await executor.simulateCreateProposal({
      contractId: CONTRACT,
      proposerAddress: MEMBER,
      recipient: RECIPIENT,
      amountBaseUnits: 4_500_000_000n,
      description: "Venue deposit",
    });
    expect(created.previewProposalId).toBe(3n);
    expect(binding.create_proposal).toHaveBeenCalledWith({
      proposer: MEMBER,
      recipient: RECIPIENT,
      amount: 4_500_000_000n,
      description: "Venue deposit",
    });

    binding.approve.mockResolvedValue({ ...assembled, result: new Ok(undefined) });
    await executor.simulateApprove({
      contractId: CONTRACT,
      memberAddress: MEMBER,
      proposalId: 2,
    });
    expect(binding.approve).toHaveBeenCalledWith({
      member: MEMBER,
      proposal_id: 2n,
    });

    binding.execute.mockResolvedValue({ ...assembled, result: new Ok(undefined) });
    await executor.simulateExecute({
      contractId: CONTRACT,
      callerAddress: MEMBER,
      proposalId: 2,
    });
    expect(binding.execute).toHaveBeenCalledWith({
      caller: MEMBER,
      proposal_id: 2n,
    });
  });

  it("rejects preview ids from Err and multi-party invocations", async () => {
    const executor = stellarProposalExecutor();
    binding.create_proposal.mockResolvedValue({
      simulation: undefined,
      result: new Err({ message: "rejected" }),
      needsNonInvokerSigningBy: () => [] as string[],
      toXDR: () => XDR,
    });
    await expect(
      executor.simulateCreateProposal({
        contractId: CONTRACT,
        proposerAddress: MEMBER,
        recipient: RECIPIENT,
        amountBaseUnits: 100n,
        description: "x",
      }),
    ).rejects.toThrow(/rejected/);

    binding.execute.mockResolvedValue({
      simulation: undefined,
      result: new Ok(undefined),
      needsNonInvokerSigningBy: () => [MEMBER],
      toXDR: () => XDR,
    });
    await expect(
      executor.simulateExecute({
        contractId: CONTRACT,
        callerAddress: MEMBER,
        proposalId: 1,
      }),
    ).rejects.toThrow(/multi-party/);
  });
});