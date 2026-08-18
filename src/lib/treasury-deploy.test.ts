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
import type * as StellarSdkModule from "@stellar/stellar-sdk";

const { deployMock } = vi.hoisted(() => ({ deployMock: vi.fn() }));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof StellarSdkModule>();
  return {
    ...actual,
    rpc: { ...actual.rpc, Server: vi.fn() },
    contract: { ...actual.contract, Client: { deploy: deployMock } },
  };
});

const MEMBER_A = `G${"A".repeat(55)}`;
const MEMBER_B = `G${"B".repeat(55)}`;
const CREATOR = MEMBER_A;
const TOKEN = `C${"B".repeat(55)}`;
const WASM = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
const WASM_HASH = "93a44bbb96c751218e4c00d479e4c14358122a389acca16205b1e4d0dc5f9476";
const XDR = "AAAAAgAAAABzaW1wbGVkLXRyYW5zYWN0aW9u";
const CONTRACT_ID = `C${"C".repeat(55)}`;

interface FakeExecutorCalls {
  uploads: Array<{ wasm: Uint8Array; publicKey: string }>;
  creates: Array<{ wasmHash: string; publicKey: string }>;
  initializes: Array<Record<string, unknown>>;
  submits: string[];
  confirms: string[];
}

function fakeExecutor(overrides: {
  createContractId?: string;
  submitError?: Error & { hash?: string };
  confirm?: "success" | "failed" | "pending";
  simulateErrorAt?: TreasuryDeployStageName;
} = {}): TreasuryDeployExecutor & { calls: FakeExecutorCalls } {
  const calls: FakeExecutorCalls = {
    uploads: [],
    creates: [],
    initializes: [],
    submits: [],
    confirms: [],
  };
  const failStage = <T,>(
    stage: TreasuryDeployStageName,
    fn: () => Promise<T>,
  ): Promise<T> =>
    overrides.simulateErrorAt === stage
      ? Promise.reject(new Error(`simulation rejected (${stage})`))
      : fn();
  return {
    calls,
    async uploadWasm(wasm, publicKey) {
      calls.uploads.push({ wasm, publicKey });
      return failStage("upload", async () => ({ preparedTxXdr: XDR }));
    },
    async createContract(wasmHash, publicKey) {
      calls.creates.push({ wasmHash, publicKey });
      return failStage("create", async () => ({
        preparedTxXdr: XDR,
        contractId: overrides.createContractId ?? CONTRACT_ID,
      }));
    },
    async initializeTreasury(params, publicKey) {
      calls.initializes.push({ ...params, publicKey });
      return failStage("initialize", async () => ({ preparedTxXdr: XDR }));
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
) {
  return vi.fn(async (xdr: string) => {
    if (typeof result === "function") return result(xdr);
    return result;
  });
}

function signedResult(): WalletSignatureResult {
  return { status: "signed", signedTxXdr: "signed-xdr", signerAddress: CREATOR };
}

function buildFlow(overrides: {
  executor?: ReturnType<typeof fakeExecutor>;
  fetchWasm?: () => Promise<Uint8Array>;
  signTransaction?: ReturnType<typeof fakeSigner>;
  registerTreasury?: ReturnType<
    typeof vi.fn<(registration: { id: string; name: string }) => void>
  >;
} = {}): {
  flow: TreasuryDeployFlow;
  executor: ReturnType<typeof fakeExecutor>;
  signTransaction: ReturnType<typeof fakeSigner>;
  registerTreasury: ReturnType<typeof vi.fn<(registration: { id: string; name: string }) => void>>;
} {
  const executor = overrides.executor ?? fakeExecutor();
  const signTransaction = overrides.signTransaction ?? fakeSigner(signedResult());
  const registerTreasury =
    overrides.registerTreasury ??
    vi.fn<(registration: { id: string; name: string }) => void>();
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
  it("deploys upload → create → initialize in order, registers the id, and returns hashes", async () => {
    const { flow, executor, registerTreasury } = buildFlow();
    const stages: Array<[TreasuryDeployStageName, TreasuryTxState]> = [];
    const outcome = await flow.deploy(details, CREATOR, TOKEN, (stage, state) => {
      stages.push([stage, state]);
    });

    expect(outcome).toEqual({
      status: "deployed",
      contractId: CONTRACT_ID,
      hashes: { upload: "abc123hash", create: "abc123hash", initialize: "abc123hash" },
    });
    expect(executor.calls.uploads).toHaveLength(1);
    expect(executor.calls.uploads[0].wasm).toEqual(WASM);
    expect(executor.calls.creates[0].wasmHash).toBe(WASM_HASH);
    expect(executor.calls.creates[0].publicKey).toBe(CREATOR);
    expect(executor.calls.initializes).toHaveLength(1);
    expect(executor.calls.initializes[0]).toMatchObject({
      contractId: CONTRACT_ID,
      creator: CREATOR,
      tokenId: TOKEN,
      members: [CREATOR, MEMBER_B],
      threshold: 2,
      name: "Trip Fund",
      publicKey: CREATOR,
    });
    expect(executor.calls.submits).toEqual(["signed-xdr", "signed-xdr", "signed-xdr"]);
    expect(executor.calls.confirms).toEqual(["abc123hash", "abc123hash", "abc123hash"]);
    expect(registerTreasury).toHaveBeenCalledWith({ id: CONTRACT_ID, name: "Trip Fund" });
    // Each stage reports preparing → awaiting-signature → submitting → confirming.
    expect(stages.filter(([stage]) => stage === "upload").map(([, s]) => s)).toEqual([
      "preparing",
      "awaiting-signature",
      "submitting",
      "confirming",
    ]);
    expect(stages.map(([stage]) => stage)).toEqual([
      "upload",
      "upload",
      "upload",
      "upload",
      "create",
      "create",
      "create",
      "create",
      "initialize",
      "initialize",
      "initialize",
      "initialize",
    ]);
  });

  it("signs each prepared transaction with the exact XDR and pays from the creator wallet", async () => {
    const signTransaction = fakeSigner((xdr) =>
      Promise.resolve({ status: "signed", signedTxXdr: `signed:${xdr}`, signerAddress: CREATOR }),
    );
    const { flow, executor } = buildFlow({ signTransaction });
    const outcome = await flow.deploy(details, CREATOR, TOKEN);
    expect(outcome.status).toBe("deployed");
    expect(executor.calls.submits).toEqual([
      `signed:${XDR}`,
      `signed:${XDR}`,
      `signed:${XDR}`,
    ]);
  });

  it("returns a validation outcome and never touches the chain", async () => {
    const { flow, executor, signTransaction } = buildFlow();
    const outcome = await flow.deploy({ ...details, threshold: 9 }, CREATOR, TOKEN);
    expect(outcome.status).toBe("validation");
    if (outcome.status === "validation") {
      expect(outcome.message).toMatch(/between 1 and 2/);
    }
    expect(executor.calls.uploads).toHaveLength(0);
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
    expect(executor.calls.uploads).toHaveLength(0);
    expect(signTransaction).not.toHaveBeenCalled();
  });

  it("never signs when the upload simulation fails, and reports the failing stage", async () => {
    const { flow, executor, signTransaction } = buildFlow({
      executor: fakeExecutor({ simulateErrorAt: "upload" }),
    });
    const outcome = await flow.deploy(details, CREATOR, TOKEN);
    expect(outcome.status).toBe("simulation-failed");
    if (outcome.status === "simulation-failed") {
      expect(outcome.stage).toBe("upload");
      expect(outcome.message).toMatch(/simulation rejected/);
    }
    expect(executor.calls.uploads).toHaveLength(1);
    expect(signTransaction).not.toHaveBeenCalled();
    expect(executor.calls.submits).toHaveLength(0);
  });

  it("signs only the stages before a later simulation failure", async () => {
    const { flow, executor, signTransaction } = buildFlow({
      executor: fakeExecutor({ simulateErrorAt: "create" }),
    });
    const outcome = await flow.deploy(details, CREATOR, TOKEN);
    expect(outcome.status).toBe("simulation-failed");
    if (outcome.status === "simulation-failed") {
      expect(outcome.stage).toBe("create");
    }
    // Upload fully signed and submitted; create never asked for a signature.
    expect(signTransaction).toHaveBeenCalledTimes(1);
    expect(executor.calls.submits).toHaveLength(1);
    expect(executor.calls.initializes).toHaveLength(0);
  });

  it("maps a cancelled signature to wallet-rejected and never submits", async () => {
    const signTransaction = fakeSigner({ status: "cancelled", message: "nope" });
    const { flow, executor } = buildFlow({ signTransaction });
    const outcome = await flow.deploy(details, CREATOR, TOKEN);
    expect(outcome.status).toBe("sign-failed");
    if (outcome.status === "sign-failed") {
      expect(outcome.stage).toBe("upload");
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
      expect(outcome.stage).toBe("upload");
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
      expect(outcome.stage).toBe("upload");
      expect(outcome.error.hash).toBe("deadbeef");
    }
  });

  it("stops at the first failing stage: a failed create never initializes or registers", async () => {
    const { flow, executor, registerTreasury } = buildFlow({
      executor: fakeExecutor({ confirm: "failed" }),
    });
    const outcome = await flow.deploy(details, CREATOR, TOKEN);
    expect(outcome.status).toBe("confirm-failed");
    if (outcome.status === "confirm-failed") {
      expect(outcome.stage).toBe("upload");
      expect(outcome.message).toMatch(/nothing was created/);
    }
    expect(executor.calls.initializes).toHaveLength(0);
    expect(registerTreasury).not.toHaveBeenCalled();
  });

  it("reports a timed-out confirmation with a reconcile hint", async () => {
    const { flow } = buildFlow({ executor: fakeExecutor({ confirm: "pending" }) });
    const outcome = await flow.deploy(details, CREATOR, TOKEN);
    expect(outcome.status).toBe("confirm-failed");
    if (outcome.status === "confirm-failed") {
      expect(outcome.stage).toBe("upload");
      expect(outcome.message).toMatch(/timed out/);
    }
  });

  it("does not register the treasury when initialize fails", async () => {
    const { flow, registerTreasury } = buildFlow({
      executor: fakeExecutor({ simulateErrorAt: "initialize" }),
    });
    const outcome = await flow.deploy(details, CREATOR, TOKEN);
    expect(outcome.status).toBe("simulation-failed");
    expect(registerTreasury).not.toHaveBeenCalled();
  });

  it("requires the creator address to be a member before any wasm work", async () => {
    const { flow, executor } = buildFlow();
    const outcome = await flow.deploy({ ...details, members: [MEMBER_B] }, CREATOR, TOKEN);
    expect(outcome.status).toBe("validation");
    expect(executor.calls.uploads).toHaveLength(0);
  });
});

describe("stellarTreasuryDeployExecutor.createContract", () => {
  beforeEach(() => {
    deployMock.mockReset();
    deployMock.mockResolvedValue({
      toXDR: () => XDR,
      simulation: undefined,
      result: { options: { contractId: CONTRACT_ID } },
    });
  });

  it("passes null constructor args so the SDK never looks up __constructor", async () => {
    const executor = stellarTreasuryDeployExecutor({
      rpcUrl: "https://rpc.example.test",
      networkPassphrase: "test-passphrase",
    });
    const outcome = await executor.createContract(WASM_HASH, CREATOR);

    expect(deployMock).toHaveBeenCalledTimes(1);
    const [args, options] = deployMock.mock.calls[0];
    // The Cohold wasm has no #[constructor]. A truthy args object (e.g. {})
    // makes the SDK call spec.funcArgsToScVals("__constructor", args), which
    // throws "no such entry: __constructor" before any transaction is built.
    expect(args).toBeNull();
    expect(options).toMatchObject({
      wasmHash: WASM_HASH,
      address: CREATOR,
      publicKey: CREATOR,
    });
    expect(outcome).toEqual({ preparedTxXdr: XDR, contractId: CONTRACT_ID });
  });
});
