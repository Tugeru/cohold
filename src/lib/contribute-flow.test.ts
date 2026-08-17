import { describe, expect, it, vi, beforeEach } from "vitest";
import { Ok } from "@stellar/stellar-sdk/contract";
import {
  createContributeFlow,
  stellarContributeExecutor,
  type ContributeExecutor,
  type ContributeFlowDeps,
} from "./contribute-flow";
import type { WalletSignatureResult } from "./wallet-adapter";

// The SDK executor constructs the generated bindings `Client`; mock the
// package so the binding-level test observes the exact invocation without
// touching a network.
const binding = vi.hoisted(() => ({
  contribute: vi.fn(),
}));

vi.mock("cohold-contract", () => {
  class Client {
    constructor(readonly options: Record<string, unknown>) {}
    contribute(args: unknown) {
      return binding.contribute(args);
    }
  }
  return { Client };
});

// The SDK executor also drives the RPC submit/confirm boundary. Mock the
// server seam so sendTransaction/pollTransaction mappings are observed
// without a network.
const rpcServer = vi.hoisted(() => ({
  instances: [] as Array<{ url: string }>,
  sendResult: undefined as unknown,
  pollResult: undefined as unknown,
  pollError: false,
}));

vi.mock("@stellar/stellar-sdk", () => ({
  rpc: {
    Server: class {
      constructor(url: string) {
        rpcServer.instances.push({ url });
      }
      async sendTransaction(_tx: unknown) {
        return rpcServer.sendResult;
      }
      async pollTransaction(_hash: string) {
        if (rpcServer.pollError) throw new Error("rpc down");
        return rpcServer.pollResult;
      }
    },
  },
  TransactionBuilder: {
    fromXDR: (xdr: string) => ({ source: xdr }),
  },
}));

beforeEach(() => {
  binding.contribute.mockReset();
  rpcServer.instances.length = 0;
  rpcServer.sendResult = undefined;
  rpcServer.pollResult = undefined;
  rpcServer.pollError = false;
});

const CONTRACT = `C${"A".repeat(55)}`;
const TOKEN = `C${"B".repeat(55)}`;
const MEMBER = `G${"A".repeat(55)}`;
const XDR = "AAAAAgAAAABzaW1wbGVkLXRyYW5zYWN0aW9u";

interface FakeExecutorCalls {
  simulate: Array<{ contractId: string; memberAddress: string; amountBaseUnits: bigint }>;
  submit: string[];
  confirm: string[];
}

function fakeExecutor(overrides: {
  simulate?: () => Promise<{ preparedTxXdr: string }>;
  submit?: () => Promise<{ hash: string }>;
  confirm?: () => Promise<"success" | "failed" | "pending">;
} = {}): ContributeExecutor & { calls: FakeExecutorCalls } {
  const calls: FakeExecutorCalls = { simulate: [], submit: [], confirm: [] };
  return {
    calls,
    async simulateContribute(input) {
      calls.simulate.push(input);
      if (overrides.simulate) return overrides.simulate();
      return { preparedTxXdr: XDR };
    },
    async submitContribute(signedTxXdr) {
      calls.submit.push(signedTxXdr);
      if (overrides.submit) return overrides.submit();
      return { hash: "abc123hash" };
    },
    async confirmContribute(hash) {
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

function buildDeps(overrides: Partial<ContributeFlowDeps> = {}): {
  executor: ReturnType<typeof fakeExecutor>;
  deps: ContributeFlowDeps;
} {
  const executor = fakeExecutor();
  const deps: ContributeFlowDeps = {
    executor,
    contractId: CONTRACT,
    memberAddress: MEMBER,
    asset: { contractId: TOKEN, symbol: "USDC", decimals: 7 },
    currentBalanceBaseUnits: "10000000000",
    isMember: vi.fn(async () => true),
    readBalance: vi.fn(async () => 10_000_000_000n),
    signTransaction: fakeSigner(signedResult()),
    ...overrides,
  };
  return { executor, deps };
}

describe("createContributeFlow.prepare", () => {
  it("rejects zero, negative, fractional, and malformed base-unit amounts before any chain call", async () => {
    const { executor, deps } = buildDeps();
    const flow = createContributeFlow(deps);
    for (const bad of ["0", "-1", "1.5", "abc", "  ", 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      const outcome = await flow.prepare(bad);
      expect(outcome.status).toBe("invalid-amount");
      if (outcome.status === "invalid-amount") {
        expect(outcome.error.kind).toBe("invalid-amount");
        expect(outcome.error.message.length).toBeGreaterThan(0);
      }
    }
    expect(executor.calls.simulate).toHaveLength(0);
    expect(deps.isMember).not.toHaveBeenCalled();
  });

  it("maps a non-member to a product error and never simulates", async () => {
    const { executor, deps } = buildDeps({
      isMember: vi.fn(async () => false),
    });
    const outcome = await createContributeFlow(deps).prepare("5000000");
    expect(outcome.status).toBe("not-member");
    if (outcome.status === "not-member") {
      expect(outcome.error.kind).toBe("not-member");
      expect(outcome.error.message).toMatch(/members/i);
    }
    expect(executor.calls.simulate).toHaveLength(0);
  });

  it("maps an unreadable membership check to a product error", async () => {
    const { executor, deps } = buildDeps({
      isMember: vi.fn(async () => {
        throw new Error("rpc down");
      }),
    });
    const outcome = await createContributeFlow(deps).prepare("5000000");
    expect(outcome.status).toBe("simulation-failed");
    expect(executor.calls.simulate).toHaveLength(0);
  });

  it("prevents signing when simulation fails", async () => {
    const { executor, deps } = buildDeps({
      executor: fakeExecutor({
        simulate: async () => {
          throw new Error("HostError");
        },
      }),
    });
    const outcome = await createContributeFlow(deps).prepare("5000000");
    expect(outcome.status).toBe("simulation-failed");
    if (outcome.status === "simulation-failed") {
      expect(outcome.error.kind).toBe("simulation-failed");
      expect(outcome.error.message).toMatch(/no funds were moved/i);
    }
    expect(deps.signTransaction).not.toHaveBeenCalled();
    expect(executor.calls.submit).toHaveLength(0);
  });

  it("maps a token-transfer failure inside simulation to a product error (no sign, no submit)", async () => {
    // The SAC transfer from the member runs inside the host call; a failure
    // (e.g. insufficient balance) surfaces as a thrown host error that is not
    // CoholdError::NotMember (#3) — it must not be mistaken for membership or
    // reach the wallet.
    const executor = fakeExecutor({
      simulate: async () => {
        throw new Error("HostError: (xlm) transfer failed: insufficient balance");
      },
    });
    const { deps } = buildDeps({ executor });
    const outcome = await createContributeFlow(deps).prepare("5000000");
    expect(outcome.status).toBe("simulation-failed");
    if (outcome.status === "simulation-failed") {
      expect(outcome.error.kind).toBe("simulation-failed");
      expect(outcome.error.message).toMatch(/no funds were moved/i);
      expect(outcome.error.message).not.toMatch(/Only members/i);
    }
    expect(deps.signTransaction).not.toHaveBeenCalled();
    expect(executor.calls.submit).toHaveLength(0);
  });

  it("maps a simulated NotMember host error (SDK path) to a product error", async () => {
    const { deps } = buildDeps({
      executor: fakeExecutor({
        simulate: async () => {
          throw new Error("Error(Contract, #3)");
        },
      }),
    });
    const outcome = await createContributeFlow(deps).prepare("5000000");
    expect(outcome.status).toBe("not-member");
  });

  it("passes only the configured contract, member, and amount to simulation (no form-supplied token)", async () => {
    const { executor, deps } = buildDeps();
    const outcome = await createContributeFlow(deps).prepare("250000000");
    expect(outcome.status).toBe("ready");
    expect(executor.calls.simulate).toEqual([
      { contractId: CONTRACT, memberAddress: MEMBER, amountBaseUnits: 250_000_000n },
    ]);
  });

  it("returns a review with exact amount, configured asset, and resulting balance", async () => {
    const { deps } = buildDeps();
    const outcome = await createContributeFlow(deps).prepare("250000000");
    expect(outcome.status).toBe("ready");
    if (outcome.status === "ready") {
      expect(outcome.review).toEqual({
        amountBaseUnits: "250000000",
        assetContractId: TOKEN,
        assetSymbol: "USDC",
        assetDecimals: 7,
        currentBalanceBaseUnits: "10000000000",
        resultingBalanceBaseUnits: "10250000000",
      });
      expect(outcome.preparedTxXdr).toBe(XDR);
    }
  });

  it("never invents a resulting balance when the current balance is unreadable", async () => {
    const { deps } = buildDeps({ currentBalanceBaseUnits: null });
    const outcome = await createContributeFlow(deps).prepare("250000000");
    expect(outcome.status).toBe("ready");
    if (outcome.status === "ready") {
      expect(outcome.review.resultingBalanceBaseUnits).toBeNull();
    }
  });

  it("computes resulting balance with exact bigint math above 2^53", async () => {
    const { deps } = buildDeps({ currentBalanceBaseUnits: "9007199254740993" });
    const outcome = await createContributeFlow(deps).prepare("1");
    expect(outcome.status).toBe("ready");
    if (outcome.status === "ready") {
      expect(outcome.review.resultingBalanceBaseUnits).toBe("9007199254740994");
    }
  });
});

describe("createContributeFlow.signAndSend", () => {
  it("signs with the prepared transaction XDR and returns the submitted hash", async () => {
    const { executor, deps } = buildDeps();
    const outcome = await createContributeFlow(deps).signAndSend(XDR);
    expect(outcome).toEqual({ status: "submitted", hash: "abc123hash" });
    expect(deps.signTransaction).toHaveBeenCalledWith(XDR);
    expect(executor.calls.submit).toEqual(["signed-xdr"]);
  });

  it("maps wallet rejection to a product error and never submits", async () => {
    const { executor, deps } = buildDeps({
      signTransaction: fakeSigner({ status: "cancelled", message: "nope" }),
    });
    const outcome = await createContributeFlow(deps).signAndSend(XDR);
    expect(outcome.status).toBe("sign-failed");
    if (outcome.status === "sign-failed") {
      expect(outcome.error.kind).toBe("wallet-rejected");
      expect(outcome.error.message).toMatch(/no funds were moved/i);
    }
    expect(executor.calls.submit).toHaveLength(0);
  });

  it("maps wrong-network signing to a product error and never submits", async () => {
    const { executor, deps } = buildDeps({
      signTransaction: fakeSigner({
        status: "wrong-network",
        network: "mainnet",
        networkPassphrase: "mainnet-passphrase",
      }),
    });
    const outcome = await createContributeFlow(deps).signAndSend(XDR);
    expect(outcome.status).toBe("sign-failed");
    if (outcome.status === "sign-failed") {
      expect(outcome.error.kind).toBe("wallet-network");
      expect(outcome.error.message).toMatch(/testnet/i);
    }
    expect(executor.calls.submit).toHaveLength(0);
  });

  it("maps a disconnected wallet to a product error and never submits", async () => {
    const { executor, deps } = buildDeps({
      signTransaction: fakeSigner({ status: "not-connected", message: "Connect Freighter" }),
    });
    const outcome = await createContributeFlow(deps).signAndSend(XDR);
    expect(outcome.status).toBe("sign-failed");
    if (outcome.status === "sign-failed") {
      expect(outcome.error.kind).toBe("wallet-unavailable");
      expect(outcome.error.message).toMatch(/connect/i);
    }
    expect(executor.calls.submit).toHaveLength(0);
  });

  it("maps submission rejection to a product error", async () => {
    const { deps } = buildDeps({
      executor: fakeExecutor({
        submit: async () => {
          throw new Error("TX_INSUFFICIENT_FEE");
        },
      }),
    });
    const outcome = await createContributeFlow(deps).signAndSend(XDR);
    expect(outcome.status).toBe("send-failed");
    if (outcome.status === "send-failed") {
      expect(outcome.error.kind).toBe("send-failed");
    }
  });
});

describe("createContributeFlow.confirm", () => {
  it("reports success only after confirmation and a re-read balance", async () => {
    const { deps } = buildDeps();
    const outcome = await createContributeFlow(deps).confirm("hash1");
    expect(outcome).toEqual({ status: "confirmed", hash: "hash1", balanceBaseUnits: "10000000000" });
    expect(deps.readBalance).toHaveBeenCalledTimes(1);
  });

  it("shows a stale confirmed state with the hash when the balance re-read fails", async () => {
    const { deps } = buildDeps({
      readBalance: vi.fn(async () => null),
    });
    const outcome = await createContributeFlow(deps).confirm("hash1");
    expect(outcome).toEqual({ status: "confirmed", hash: "hash1", balanceBaseUnits: null });
  });

  it("treats a throwing balance re-read as stale, never an invented balance", async () => {
    const { deps } = buildDeps({
      readBalance: vi.fn(async () => {
        throw new Error("rpc down");
      }),
    });
    const outcome = await createContributeFlow(deps).confirm("hash1");
    expect(outcome).toEqual({ status: "confirmed", hash: "hash1", balanceBaseUnits: null });
  });

  it("maps a FAILED confirmation to a product error with the hash", async () => {
    const { executor, deps } = buildDeps();
    executor.calls.confirm = [];
    const outcome = await createContributeFlow(
      buildDeps({
        executor: fakeExecutor({ confirm: async () => "failed" }),
      }).deps,
    ).confirm("hashbad");
    expect(outcome.status).toBe("failed");
    if (outcome.status === "failed") {
      expect(outcome.hash).toBe("hashbad");
      expect(outcome.error.kind).toBe("transaction-failed");
      expect(outcome.error.message).toMatch(/no funds were moved/i);
    }
  });

  it("keeps a still-pending confirmation retryable with the hash", async () => {
    const { deps } = buildDeps({
      executor: fakeExecutor({ confirm: async () => "pending" }),
    });
    const outcome = await createContributeFlow(deps).confirm("hashslow");
    expect(outcome).toEqual({ status: "confirmation-pending", hash: "hashslow" });
  });

  it("maps a confirmation transport error to failed-with-hash without touching the balance", async () => {
    const { deps } = buildDeps({
      executor: fakeExecutor({
        confirm: async () => {
          throw new Error("rpc down");
        },
      }),
    });
    const outcome = await createContributeFlow(deps).confirm("hash1");
    expect(outcome.status).toBe("failed");
    if (outcome.status === "failed") {
      expect(outcome.hash).toBe("hash1");
    }
    expect(deps.readBalance).not.toHaveBeenCalled();
  });
});

describe("createContributeFlow.reReadBalance", () => {
  it("returns a normalized balance string or null, never throwing", async () => {
    const { deps } = buildDeps();
    const flow = createContributeFlow(deps);
    await expect(flow.reReadBalance()).resolves.toBe("10000000000");
    const failing = createContributeFlow(
      buildDeps({
        readBalance: vi.fn(async () => {
          throw new Error("rpc down");
        }),
      }).deps,
    );
    await expect(failing.reReadBalance()).resolves.toBeNull();
  });
});

describe("stellarContributeExecutor", () => {
  it("is constructible without network configuration", () => {
    const executor = stellarContributeExecutor();
    expect(typeof executor.simulateContribute).toBe("function");
    expect(typeof executor.submitContribute).toBe("function");
    expect(typeof executor.confirmContribute).toBe("function");
  });

  it("invokes the generated client with the wallet member and exact amount", async () => {
    binding.contribute.mockResolvedValue({
      simulation: undefined,
      result: new Ok(undefined),
      needsNonInvokerSigningBy: () => [] as string[],
      toXDR: () => XDR,
    });

    const prepared = await stellarContributeExecutor().simulateContribute({
      contractId: CONTRACT,
      memberAddress: MEMBER,
      amountBaseUnits: 5_000_000_000n,
    });
    expect(prepared.preparedTxXdr).toBe(XDR);
    expect(binding.contribute).toHaveBeenCalledWith({
      member: MEMBER,
      amount: 5_000_000_000n,
    });
  });

  it("refuses multi-party authorization before producing XDR", async () => {
    binding.contribute.mockResolvedValue({
      simulation: undefined,
      result: new Ok(undefined),
      needsNonInvokerSigningBy: () => [MEMBER],
      toXDR: () => XDR,
    });
    await expect(
      stellarContributeExecutor().simulateContribute({
        contractId: CONTRACT,
        memberAddress: MEMBER,
        amountBaseUnits: 100n,
      }),
    ).rejects.toThrow(/multi-party/);
  });

  it("submits the wallet-signed XDR to the Testnet RPC and returns the hash", async () => {
    rpcServer.sendResult = { status: "PENDING", hash: "txhash1" };
    const result = await stellarContributeExecutor().submitContribute("signed-xdr");
    expect(result).toEqual({ hash: "txhash1" });
    expect(rpcServer.instances).toHaveLength(1);
    expect(rpcServer.instances[0].url).toBe("https://soroban-testnet.stellar.org");
  });

  it("throws when RPC rejects the signed transaction before execution", async () => {
    rpcServer.sendResult = { status: "ERROR", errorResult: "TX_INSUFFICIENT_FEE" };
    await expect(
      stellarContributeExecutor().submitContribute("signed-xdr"),
    ).rejects.toThrow(/no funds were moved/);
  });

  it("maps an RPC SUCCESS poll to success", async () => {
    rpcServer.pollResult = { status: "SUCCESS" };
    await expect(
      stellarContributeExecutor().confirmContribute("txhash1"),
    ).resolves.toBe("success");
  });

  it("maps an RPC FAILED poll to failed", async () => {
    rpcServer.pollResult = { status: "FAILED" };
    await expect(
      stellarContributeExecutor().confirmContribute("txhash1"),
    ).resolves.toBe("failed");
  });

  it("keeps non-terminal polls pending for retry", async () => {
    rpcServer.pollResult = { status: "NOT_FOUND" };
    await expect(
      stellarContributeExecutor().confirmContribute("txhash1"),
    ).resolves.toBe("pending");
  });

  it("propagates confirm transport failures for the flow to map", async () => {
    rpcServer.pollError = true;
    await expect(
      stellarContributeExecutor().confirmContribute("txhash1"),
    ).rejects.toThrow("rpc down");
  });
});