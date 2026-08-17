import { describe, expect, it } from "vitest";
import {
  diagnoseWalletResources,
  firstFailureMessage,
  walletCheckLabel,
  type WalletCheckFailure,
  type WalletDiagnosticsResult,
  type WalletDiagnosticsDeps,
} from "./wallet-diagnostics";
import type { ChainTreasuryConfig, CoholdRpc } from "./contract-adapter";
import {
  type CoholdConfig,
  resolveCoholdConfig,
} from "./cohold-config";

const CONTRACT = `C${"A".repeat(55)}`;
const EXTRA = `C${"C".repeat(55)}`;
const TOKEN = `C${"B".repeat(55)}`;
const OTHER_TOKEN = `C${"D".repeat(55)}`;

const chainConfig: ChainTreasuryConfig = {
  name: "IT Society Event Fund",
  creator: `G${"A".repeat(55)}`,
  tokenAddress: TOKEN,
  threshold: 2,
  memberCount: 3,
};

function walletConfig(overrides: Partial<CoholdEnv> = {}): CoholdConfig {
  return resolveCoholdConfig({
    NEXT_PUBLIC_COHOLD_MODE: "wallet",
    NEXT_PUBLIC_STELLAR_NETWORK: "TESTNET",
    NEXT_PUBLIC_STELLAR_CONTRACT_ID: CONTRACT,
    NEXT_PUBLIC_STELLAR_TOKEN_ID: TOKEN,
    ...overrides,
  });
}

function fakeRpc(overrides: Partial<CoholdRpc> = {}): CoholdRpc {
  const base: CoholdRpc = {
    async getHealth() {
      return true;
    },
    async getConfig(contractId) {
      return contractId === CONTRACT ? { ...chainConfig } : null;
    },
    async getBalance() {
      return 10_000_000_000n;
    },
    async getMemberList() {
      return [`G${"A".repeat(55)}`, `G${"B".repeat(55)}`];
    },
    async getProposalCount() {
      return 0;
    },
    async getProposal() {
      return null;
    },
    async isMember() {
      return false;
    },
    async hasApproved() {
      return false;
    },
    async getTokenInfo() {
      return { symbol: "USDC", decimals: 7 };
    },
    async getRecentEvents() {
      return [];
    },
  };
  return { ...base, ...overrides };
}

function failuresOf(result: WalletDiagnosticsResult): WalletCheckFailure[] {
  expect(result.status).toBe("failed");
  return result.status === "failed" ? result.failures : [];
}

function failureIds(result: WalletDiagnosticsResult): string[] {
  return failuresOf(result).map((failure) => failure.id);
}

type CoholdEnv = Parameters<typeof resolveCoholdConfig>[0];

describe("diagnoseWalletResources", () => {
  it("reports healthy when network, RPC, contract shape, token, and reads all pass", async () => {
    const result = await diagnoseWalletResources({
      config: walletConfig(),
      rpc: fakeRpc(),
    });
    expect(result).toEqual({ status: "healthy", checkedContractIds: [CONTRACT] });
  });

  it("checks every configured contract, including extras", async () => {
    const result = await diagnoseWalletResources({
      config: walletConfig({ NEXT_PUBLIC_STELLAR_CONTRACT_IDS: EXTRA }),
      rpc: fakeRpc({ getConfig: () => Promise.resolve({ ...chainConfig }) }),
    });
    expect(result.status).toBe("healthy");
    expect(result.status === "healthy" && result.checkedContractIds).toEqual([CONTRACT, EXTRA]);
  });

  it("fails closed on a contract that is not Cohold-shaped", async () => {
    const result = await diagnoseWalletResources({
      config: walletConfig(),
      rpc: fakeRpc({ getConfig: async () => null }),
    });
    expect(failureIds(result)).toContain("contract");
    expect(failuresOf(result)[0].contractId).toBe(CONTRACT);
  });

  it("fails closed when get_config throws", async () => {
    const result = await diagnoseWalletResources({
      config: walletConfig(),
      rpc: fakeRpc({
        getConfig: async () => {
          throw new Error("rpc unavailable");
        },
      }),
    });
    expect(failureIds(result)).toContain("contract");
  });

  it("fails closed when the on-chain token differs from the configured token", async () => {
    const result = await diagnoseWalletResources({
      config: walletConfig(),
      rpc: fakeRpc({
        getConfig: async () => ({ ...chainConfig, tokenAddress: OTHER_TOKEN }),
      }),
    });
    expect(failureIds(result)).toContain("token");
    const tokenFailure = failuresOf(result).find((failure) => failure.id === "token");
    expect(tokenFailure?.message).toContain(OTHER_TOKEN);
  });

  it("fails closed when the configured token is missing", async () => {
    const result = await diagnoseWalletResources({
      config: walletConfig({ NEXT_PUBLIC_STELLAR_TOKEN_ID: undefined }),
      rpc: fakeRpc(),
    });
    expect(failureIds(result)).toContain("token");
  });

  it("fails closed when members or balance are unreadable", async () => {
    const result = await diagnoseWalletResources({
      config: walletConfig(),
      rpc: fakeRpc({ getMemberList: async () => null }),
    });
    expect(failureIds(result)).toContain("readable");
  });

  it("fails closed when member list read throws", async () => {
    const result = await diagnoseWalletResources({
      config: walletConfig(),
      rpc: fakeRpc({
        getMemberList: async () => {
          throw new Error("rpc unavailable");
        },
      }),
    });
    expect(failureIds(result)).toContain("readable");
  });

  it("fails closed when the balance read returns null", async () => {
    const result = await diagnoseWalletResources({
      config: walletConfig(),
      rpc: fakeRpc({ getBalance: async () => null }),
    });
    expect(failureIds(result)).toContain("readable");
  });

  it("fails closed when RPC is unreachable", async () => {
    const result = await diagnoseWalletResources({
      config: walletConfig(),
      rpc: fakeRpc({
        getHealth: async () => {
          throw new Error("ECONNREFUSED");
        },
      }),
    });
    expect(failureIds(result)).toContain("rpc");
  });

  it("fails closed when the health probe reports a non-healthy node", async () => {
    const result = await diagnoseWalletResources({
      config: walletConfig(),
      rpc: fakeRpc({ getHealth: async () => false }),
    });
    expect(failureIds(result)).toContain("rpc");
  });

  it("fails closed on a non-Testnet or incomplete wallet setup", async () => {
    const result = await diagnoseWalletResources({
      config: walletConfig({ NEXT_PUBLIC_STELLAR_CONTRACT_ID: undefined }),
      rpc: fakeRpc(),
    });
    expect(failureIds(result)).toContain("network");
  });

  it("collects every failed check instead of stopping at the first", async () => {
    const result = await diagnoseWalletResources({
      config: walletConfig(),
      rpc: fakeRpc({
        getHealth: async () => false,
        getConfig: async () => ({ ...chainConfig, tokenAddress: OTHER_TOKEN }),
        getMemberList: async () => null,
      }),
    });
    const ids = failureIds(result);
    expect(ids).toContain("rpc");
    expect(ids).toContain("token");
    expect(ids).toContain("readable");
  });
});

describe("firstFailureMessage", () => {
  it("returns the first failure message for a failed result", () => {
    const result: WalletDiagnosticsResult = {
      status: "failed",
      failures: [{ id: "rpc", message: "RPC down" }],
    };
    expect(firstFailureMessage(result)).toBe("RPC down");
  });

  it("returns null for healthy or unknown state", () => {
    const healthy: WalletDiagnosticsResult = { status: "healthy", checkedContractIds: [] };
    expect(firstFailureMessage(healthy)).toBeNull();
    expect(firstFailureMessage(null)).toBeNull();
  });
});

describe("walletCheckLabel", () => {
  it("labels every check id", () => {
    const deps: WalletDiagnosticsDeps = {
      config: walletConfig(),
      rpc: fakeRpc(),
    };
    void deps;
    expect(walletCheckLabel("network")).toMatch(/Testnet/);
    expect(walletCheckLabel("rpc")).toMatch(/RPC/);
    expect(walletCheckLabel("contract")).toMatch(/Cohold/);
    expect(walletCheckLabel("token")).toMatch(/Token/);
    expect(walletCheckLabel("readable")).toMatch(/balance/i);
  });
});