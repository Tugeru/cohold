import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createTreasuryDeployFlow,
  stellarTreasuryDeployExecutor,
  validateTreasuryDetails,
  type TreasuryDeployFlow,
  type TreasuryDeployFlowDeps,
  type TreasuryDeployExecutor,
  type TreasuryDeployStageName,
  type TreasuryTxState,
} from "./treasury-deploy";
import type { WalletSignatureResult } from "./wallet-adapter";

const { factoryCreateMock, factoryClientMock } = vi.hoisted(() => {
  const factoryCreateMock = vi.fn();
  const factoryClientMock = vi.fn(function () {
    return { create: factoryCreateMock };
  });
  return { factoryCreateMock, factoryClientMock };
});

vi.mock("cohold-factory-contract", () => ({
  Client: factoryClientMock,
}));

const MEMBER_A = `G${"A".repeat(55)}`;
const MEMBER_B = `G${"B".repeat(55)}`;
const CREATOR = MEMBER_A;
const TOKEN = `C${"B".repeat(55)}`;
const WASM = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
const WASM_HASH = "93a44bbb96c751218e4c00d479e4c14358122a389acca16205b1e4d0dc5f9476";
const XDR = "AAAAAgAAAABzaW1wbGVkLXRyYW5zYWN0aW9u";
const CONTRACT_ID = `C${"C".repeat(55)}`;
const FACTORY_ID = `C${"D".repeat(55)}`;

type FakeExecutor = TreasuryDeployExecutor & { calls: FakeExecutorCalls };
type SignTransactionFn = (xdr: string) => Promise<WalletSignatureResult>;
type RegisterTreasuryFn = (registration: { id: string; name: string }) => void;
  interface FakeExecutorCalls {
  creates: Array<Record<string, unknown> & { publicKey: string }>;
  submits: string[];
  confirms: string[];
}

function fakeExecutor(overrides: {
  createContractId?: string;
  submitError?: Error & { hash?: string };
  confirm?: "success" | "failed" | "pending";
  simulateError?: boolean;
} = {}): FakeExecutor {
  const calls: FakeExecutorCalls = { creates: [], submits: [], confirms: [] };
  return {
    calls,
    async createTreasury(params, publicKey) {
      calls.creates.push({ ...params, publicKey });
      if (overrides.simulateError) {
        throw new Error("simulation rejected (create)");
      }
      return {
        preparedTxXdr: XDR,
        contractId: overrides.createContractId ?? CONTRACT_ID,
      };
    },
    async submitInvocation(signedTxXdr) {
      calls.submits.push(signedTxXdr);
      if (overrides.submitError) throw overrides.submitError;
      return { hash: "abc123hash" };
    },
    async confirmInvocation(hash) {
      calls.confirms.push(hash);
      return overrides.confirm ?? "success";
    },
  };
}

function fakeSigner(
  result: WalletSignatureResult | ((xdr: string) => Promise<WalletSignatureResult>),
): SignTransactionFn {
  return vi.fn(async (xdr: string) => {
    if (typeof result === "function") return result(xdr);
    return result;
  });
}

function signedResult(): WalletSignatureResult {
  return { status: "signed", signedTxXdr: "signed-xdr", signerAddress: CREATOR };
}

function buildFlow(overrides: {
  executor?: FakeExecutor;
  fetchWasm?: () => Promise<Uint8Array>;
  signTransaction?: SignTransactionFn;
  registerTreasury?: RegisterTreasuryFn;
} = {}): {
  flow: TreasuryDeployFlow;
  executor: FakeExecutor;
  signTransaction: SignTransactionFn;
  registerTreasury: RegisterTreasuryFn;
} {
  const executor = overrides.executor ?? fakeExecutor();
  const signTransaction = overrides.signTransaction ?? fakeSigner(signedResult());
  const registerTreasury = overrides.registerTreasury ?? vi.fn<RegisterTreasuryFn>();
  const deps: TreasuryDeployFlowDeps = {
    executor,
    fetchWasm: overrides.fetchWasm ?? (async () => WASM),
    signTransaction,
    registerTreasury,
  };
  return { flow: createTreasuryDeployFlow(deps), executor, signTransaction, registerTreasury };
}

const details = {
  name: "Trip Fund",
  members: [CREATOR, MEMBER_B],
  threshold: 2,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("validateTreasuryDetails", () => {
  it("accepts a valid treasury including the creator", () => {
    expect(validateTreasuryDetails(details, CREATOR)).toBeNull();
  });

  it("rejects an empty or oversized name", () => {
    expect(validateTreasuryDetails({ ...details, name: "  " }, CREATOR)).toMatch(/name/i);
    expect(
      validateTreasuryDetails({ ...details, name: "x".repeat(61) }, CREATOR),
    ).toMatch(/60 characters/);
  });

  it("rejects malformed member addresses", () => {
    expect(
      validateTreasuryDetails({ ...details, members: [CREATOR, "not-an-address"] }, CREATOR),
    ).toMatch(/valid Stellar address/);
  });

  it("rejects duplicate members", () => {
    expect(
      validateTreasuryDetails({ ...details, members: [CREATOR, CREATOR] }, CREATOR),
    ).toMatch(/duplicate/i);
  });

  it("rejects a creator who is not a member", () => {
    expect(validateTreasuryDetails({ ...details, members: [MEMBER_B] }, CREATOR)).toMatch(
      /must be a member/,
    );
  });

  it("rejects thresholds outside 1..member count and non-integers", () => {
    expect(validateTreasuryDetails({ ...details, threshold: 0 }, CREATOR)).toMatch(
      /between 1 and 2/,
    );
    expect(validateTreasuryDetails({ ...details, threshold: 3 }, CREATOR)).toMatch(
      /between 1 and 2/,
    );
    expect(validateTreasuryDetails({ ...details, threshold: 1.5 }, CREATOR)).toMatch(
      /between 1 and 2/,
    );
  });

  it("rejects without a connected creator", () => {
    expect(validateTreasuryDetails(details, null)).toMatch(/Connect Freighter/);
  });
});

describe("createTreasuryDeployFlow.deploy", () => {
  it("creates through the factory in one stage, registers the id, and returns the hash", async () => {
    const { flow, executor, registerTreasury } = buildFlow();
    const stages: Array<[TreasuryDeployStageName, TreasuryTxState]> = [];
    const outcome = await flow.deploy(details, CREATOR, TOKEN, (stage, state) => {
      stages.push([stage, state]);
    });

    expect(outcome).toEqual({
      status: "deployed",
      contractId: CONTRACT_ID,
      hash: "abc123hash",
    });
    expect(executor.calls.creates).toHaveLength(1);
    expect(executor.calls.creates[0]).toMatchObject({
      wasmHash: WASM_HASH,
      creator: CREATOR,
      tokenId: TOKEN,
      members: [CREATOR, MEMBER_B],
      threshold: 2,
      name: "Trip Fund",
      publicKey: CREATOR,
    });
    expect(executor.calls.submits).toEqual(["signed-xdr"]);
    expect(executor.calls.confirms).toEqual(["abc123hash"]);
    expect(registerTreasury).toHaveBeenCalledWith({ id: CONTRACT_ID, name: "Trip Fund" });
    expect(stages).toEqual([
      ["create", "preparing"],
      ["create", "awaiting-signature"],
      ["create", "submitting"],
      ["create", "confirming"],
    ]);
  });

  it("signs the prepared transaction with the exact XDR and pays from the creator wallet", async () => {
    const signTransaction = fakeSigner((xdr) =>
      Promise.resolve({ status: "signed", signedTxXdr: `signed:${xdr}`, signerAddress: CREATOR }),
    );
    const { flow, executor } = buildFlow({ signTransaction });
    const outcome = await flow.deploy(details, CREATOR, TOKEN);
    expect(outcome.status).toBe("deployed");
    expect(executor.calls.submits).toEqual([`signed:${XDR}`]);
  });

  it("returns a validation outcome and never touches the chain", async () => {
    const { flow, executor, signTransaction } = buildFlow();
    const outcome = await flow.deploy({ ...details, threshold: 9 }, CREATOR, TOKEN);
    expect(outcome.status).toBe("validation");
    if (outcome.status === "validation") {
      expect(outcome.message).toMatch(/between 1 and 2/);
    }
    expect(executor.calls.creates).toHaveLength(0);
    expect(signTransaction).not.toHaveBeenCalled();
  });

  it("returns wasm-unavailable when the wasm fetch fails, without signing", async () => {
    const { flow, executor, signTransaction } = buildFlow({
      fetchWasm: async () => {
        throw new Error("404");
      },
    });
    const outcome = await flow.deploy(details, CREATOR, TOKEN);
    expect(outcome.status).toBe("wasm-unavailable");
    if (outcome.status === "wasm-unavailable") {
      expect(outcome.message).toMatch(/could not be loaded/);
    }
    expect(executor.calls.creates).toHaveLength(0);
    expect(signTransaction).not.toHaveBeenCalled();
  });

  it("never signs when simulation fails, and reports the failing stage", async () => {
    const { flow, executor, signTransaction } = buildFlow({
      executor: fakeExecutor({ simulateError: true }),
    });
    const outcome = await flow.deploy(details, CREATOR, TOKEN);
    expect(outcome.status).toBe("simulation-failed");
    if (outcome.status === "simulation-failed") {
      expect(outcome.stage).toBe("create");
      expect(outcome.message).toMatch(/simulation rejected/);
    }
    expect(executor.calls.creates).toHaveLength(1);
    expect(signTransaction).not.toHaveBeenCalled();
    expect(executor.calls.submits).toHaveLength(0);
  });

  it("reports simulation-failed when creation returns no contract id", async () => {
    const { flow, executor, signTransaction } = buildFlow({
      executor: fakeExecutor({ createContractId: "" }),
    });
    const outcome = await flow.deploy(details, CREATOR, TOKEN);
    expect(outcome.status).toBe("simulation-failed");
    if (outcome.status === "simulation-failed") {
      expect(outcome.message).toMatch(/did not return a contract id/);
    }
    expect(signTransaction).toHaveBeenCalledTimes(1);
    expect(executor.calls.submits).toHaveLength(1);
  });

  it("maps a cancelled signature to wallet-rejected and never submits", async () => {
    const signTransaction = fakeSigner({ status: "cancelled", message: "nope" });
    const { flow, executor } = buildFlow({ signTransaction });
    const outcome = await flow.deploy(details, CREATOR, TOKEN);
    expect(outcome.status).toBe("sign-failed");
    if (outcome.status === "sign-failed") {
      expect(outcome.stage).toBe("create");
      expect(outcome.error.kind).toBe("wallet-rejected");
    }
    expect(executor.calls.submits).toHaveLength(0);
  });

  it("maps a wrong-network signature before any submit", async () => {
    const signTransaction = fakeSigner({
      status: "wrong-network",
      network: "mainnet",
      networkPassphrase: "mainnet-passphrase",
    });
    const { flow, executor } = buildFlow({ signTransaction });
    const outcome = await flow.deploy(details, CREATOR, TOKEN);
    expect(outcome.status).toBe("sign-failed");
    if (outcome.status === "sign-failed") {
      expect(outcome.error.kind).toBe("wallet-network");
      expect(outcome.stage).toBe("create");
    }
    expect(executor.calls.submits).toHaveLength(0);
  });

  it("maps a rejected submission to send-failed with the response hash", async () => {
    const submitError = Object.assign(new Error("Testnet rejected the transaction"), {
      hash: "deadbeef",
    });
    const { flow, executor } = buildFlow({
      executor: fakeExecutor({ submitError }),
    });
    const outcome = await flow.deploy(details, CREATOR, TOKEN);
    expect(outcome.status).toBe("send-failed");
    if (outcome.status === "send-failed") {
      expect(outcome.stage).toBe("create");
      expect(outcome.error.hash).toBe("deadbeef");
    }
  });

  it("does not register when the network rejects the confirmed transaction", async () => {
    const { flow, executor, registerTreasury } = buildFlow({
      executor: fakeExecutor({ confirm: "failed" }),
    });
    const outcome = await flow.deploy(details, CREATOR, TOKEN);
    expect(outcome.status).toBe("confirm-failed");
    if (outcome.status === "confirm-failed") {
      expect(outcome.stage).toBe("create");
      expect(outcome.message).toMatch(/nothing was created/);
    }
    expect(registerTreasury).not.toHaveBeenCalled();
  });

  it("reports a timed-out confirmation with a reconcile hint", async () => {
    const { flow } = buildFlow({ executor: fakeExecutor({ confirm: "pending" }) });
    const outcome = await flow.deploy(details, CREATOR, TOKEN);
    expect(outcome.status).toBe("confirm-failed");
    if (outcome.status === "confirm-failed") {
      expect(outcome.stage).toBe("create");
      expect(outcome.message).toMatch(/timed out/);
    }
  });

  it("requires the creator address to be a member before any wasm work", async () => {
    const { flow, executor, signTransaction } = buildFlow();
    const outcome = await flow.deploy({ ...details, members: [MEMBER_B] }, CREATOR, TOKEN);
    expect(outcome.status).toBe("validation");
    expect(executor.calls.creates).toHaveLength(0);
    expect(signTransaction).not.toHaveBeenCalled();
  });
});

describe("stellarTreasuryDeployExecutor.createTreasury", () => {
  beforeEach(() => {
    factoryCreateMock.mockReset();
    factoryCreateMock.mockResolvedValue({
      toXDR: () => XDR,
      simulation: undefined,
      result: { unwrap: () => CONTRACT_ID },
    });
  });

  it("requires a configured factory id", () => {
    expect(() =>
      stellarTreasuryDeployExecutor({
        rpcUrl: "https://rpc.example.test",
        networkPassphrase: "test-passphrase",
      }),
    ).toThrow(/factory is not configured/);
  });

  it("calls factory.create with the hashed wasm, creator, token, and rules, then decodes the id", async () => {
    const executor = stellarTreasuryDeployExecutor({
      rpcUrl: "https://rpc.example.test",
      networkPassphrase: "test-passphrase",
      factoryId: FACTORY_ID,
    });
    const outcome = await executor.createTreasury(
      {
        wasmHash: WASM_HASH,
        creator: CREATOR,
        tokenId: TOKEN,
        members: [CREATOR, MEMBER_B],
        threshold: 2,
        name: "Trip Fund",
      },
      CREATOR,
    );

    expect(factoryCreateMock).toHaveBeenCalledTimes(1);
    const [args] = factoryCreateMock.mock.calls[0];
    expect(args.wasm_hash).toEqual(Buffer.from(WASM_HASH, "hex"));
    expect(args.creator).toBe(CREATOR);
    expect(args.token).toBe(TOKEN);
    expect(args.members).toEqual([CREATOR, MEMBER_B]);
    expect(args.threshold).toBe(2);
    expect(args.name).toBe("Trip Fund");
    expect(outcome).toEqual({ preparedTxXdr: XDR, contractId: CONTRACT_ID });
  });

  it("rejects when the factory simulation failed", async () => {
    factoryCreateMock.mockResolvedValue({
      toXDR: () => XDR,
      simulation: { error: "MissingWasm" },
      result: undefined,
    });
    const executor = stellarTreasuryDeployExecutor({
      rpcUrl: "https://rpc.example.test",
      networkPassphrase: "test-passphrase",
      factoryId: FACTORY_ID,
    });
    await expect(
      executor.createTreasury(
        {
          wasmHash: WASM_HASH,
          creator: CREATOR,
          tokenId: TOKEN,
          members: [CREATOR, MEMBER_B],
          threshold: 2,
          name: "Trip Fund",
        },
        CREATOR,
      ),
    ).rejects.toThrow("MissingWasm");
  });

  it("rejects a missing or malformed contract id from the result", async () => {
    factoryCreateMock.mockResolvedValue({
      toXDR: () => XDR,
      simulation: undefined,
      result: { unwrap: () => "not-a-contract-id" },
    });
    const executor = stellarTreasuryDeployExecutor({
      rpcUrl: "https://rpc.example.test",
      networkPassphrase: "test-passphrase",
      factoryId: FACTORY_ID,
    });
    await expect(
      executor.createTreasury(
        {
          wasmHash: WASM_HASH,
          creator: CREATOR,
          tokenId: TOKEN,
          members: [CREATOR, MEMBER_B],
          threshold: 2,
          name: "Trip Fund",
        },
        CREATOR,
      ),
    ).rejects.toThrow(/unexpected contract id/);
  });
});