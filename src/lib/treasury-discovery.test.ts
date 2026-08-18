import { describe, expect, it, vi, beforeEach } from "vitest";
import type { CoholdConfig } from "./cohold-config";

const { getTreasuriesMock, clientConstructorMock } = vi.hoisted(() => {
  const getTreasuriesMock = vi.fn();
  const clientConstructorMock = vi.fn(function () {
    return { get_treasuries: getTreasuriesMock };
  });
  return { getTreasuriesMock, clientConstructorMock };
});

vi.mock("cohold-factory-contract", () => ({
  Client: clientConstructorMock,
}));

const FACTORY_ID = `C${"D".repeat(55)}`;
const TREASURY_A = `C${"E".repeat(55)}`;
const TREASURY_B = `C${"F".repeat(55)}`;
const PUBLIC_KEY = `G${"A".repeat(55)}`;
const RPC_URL = "https://rpc.example.test";

const factoryConfig: CoholdConfig = {
  mode: "wallet",
  modeConfigured: true,
  network: "TESTNET",
  contractId: `C${"B".repeat(55)}`,
  extraContractIds: [],
  tokenId: `C${"C".repeat(55)}`,
  rpcUrl: null,
  walletSetupComplete: true,
  factoryId: FACTORY_ID,
};

const noFactoryConfig: CoholdConfig = { ...factoryConfig, factoryId: null };

beforeEach(() => {
  // mockClear keeps the constructible implementation; mockReset would strip it.
  clientConstructorMock.mockClear();
  getTreasuriesMock.mockReset();
});

/** Fresh module instance so the shared cache/in-flight state resets per test. */
async function loadDiscovery() {
  vi.resetModules();
  return import("./treasury-discovery");
}

describe("ensureFactoryTreasuryDiscovery", () => {
  it("reads factory-created treasuries and exposes them to the registry union", async () => {
    getTreasuriesMock.mockResolvedValue({
      simulation: undefined,
      result: [TREASURY_A, TREASURY_B],
    });
    const discovery = await loadDiscovery();
    const registry = await import("./treasury-registry");

    const ids = await discovery.ensureFactoryTreasuryDiscovery(
      factoryConfig,
      PUBLIC_KEY,
      RPC_URL,
    );
    expect(ids).toEqual([TREASURY_A, TREASURY_B]);
    expect(discovery.factoryTreasuryIds()).toEqual([TREASURY_A, TREASURY_B]);
    expect(clientConstructorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: FACTORY_ID,
        rpcUrl: RPC_URL,
        publicKey: PUBLIC_KEY,
      }),
    );
    // The wallet registry merges discovered ids with configured ones.
    expect(registry.walletTreasuryContractIds(factoryConfig)).toEqual([
      factoryConfig.contractId,
      TREASURY_A,
      TREASURY_B,
    ]);
  });

  it("shares one in-flight fetch between concurrent callers", async () => {
    getTreasuriesMock.mockResolvedValue({ simulation: undefined, result: [TREASURY_A] });
    const discovery = await loadDiscovery();
    const [a, b] = await Promise.all([
      discovery.ensureFactoryTreasuryDiscovery(factoryConfig, PUBLIC_KEY, RPC_URL),
      discovery.ensureFactoryTreasuryDiscovery(factoryConfig, PUBLIC_KEY, RPC_URL),
    ]);
    expect(a).toEqual([TREASURY_A]);
    expect(b).toEqual([TREASURY_A]);
    expect(clientConstructorMock).toHaveBeenCalledTimes(1);
  });

  it("skips discovery without a connected wallet", async () => {
    const discovery = await loadDiscovery();
    const ids = await discovery.ensureFactoryTreasuryDiscovery(
      factoryConfig,
      null,
      RPC_URL,
    );
    expect(ids).toEqual([]);
    expect(clientConstructorMock).not.toHaveBeenCalled();
  });

  it("skips discovery when the factory is not configured", async () => {
    const discovery = await loadDiscovery();
    const ids = await discovery.ensureFactoryTreasuryDiscovery(
      noFactoryConfig,
      PUBLIC_KEY,
      RPC_URL,
    );
    expect(ids).toEqual([]);
    expect(clientConstructorMock).not.toHaveBeenCalled();
  });

  it("fails open when RPC discovery errors", async () => {
    getTreasuriesMock.mockRejectedValue(new Error("rpc down"));
    const discovery = await loadDiscovery();
    const ids = await discovery.ensureFactoryTreasuryDiscovery(
      factoryConfig,
      PUBLIC_KEY,
      RPC_URL,
    );
    expect(ids).toEqual([]);
  });

  it("treats a contract simulation error as no discovered treasuries", async () => {
    getTreasuriesMock.mockResolvedValue({
      simulation: { error: "boom" },
      result: [TREASURY_A],
    });
    const discovery = await loadDiscovery();
    const ids = await discovery.ensureFactoryTreasuryDiscovery(
      factoryConfig,
      PUBLIC_KEY,
      RPC_URL,
    );
    expect(ids).toEqual([]);
  });

  it("filters malformed ids out of the discovery result", async () => {
    getTreasuriesMock.mockResolvedValue({
      simulation: undefined,
      result: [TREASURY_A, "not-a-contract-id"],
    });
    const discovery = await loadDiscovery();
    const ids = await discovery.ensureFactoryTreasuryDiscovery(
      factoryConfig,
      PUBLIC_KEY,
      RPC_URL,
    );
    expect(ids).toEqual([TREASURY_A]);
  });
});