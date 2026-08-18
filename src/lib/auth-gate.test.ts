import { describe, expect, it } from "vitest";
import {
  authenticationBlockReason,
  isAuthenticated,
  type AuthSession,
} from "@/lib/auth-gate";
import type { CoholdConfig } from "@/lib/cohold-config";
import type { WalletDiagnosticsResult } from "@/lib/wallet-diagnostics";

const walletConfig: CoholdConfig = {
  mode: "wallet",
  modeConfigured: true,
  network: "TESTNET",
  contractId: "CCYKPLZE4OT7LIBUPWRQ4UGARQTOVBORYLV3ZQIKSKVI77Z5JVV3CVR2",
  extraContractIds: [],
  tokenId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  rpcUrl: null,
  walletSetupComplete: true,
  factoryId: null,
};

const demoConfig: CoholdConfig = { ...walletConfig, mode: "demo" };

const healthy: WalletDiagnosticsResult = {
  status: "healthy",
  checkedContractIds: ["CCYKPLZE4OT7LIBUPWRQ4UGARQTOVBORYLV3ZQIKSKVI77Z5JVV3CVR2"],
};
const failed: WalletDiagnosticsResult = {
  status: "failed",
  failures: [{ id: "rpc", message: "RPC unreachable" }],
};

function session(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    connected: true,
    networkAllowed: true,
    diagnostics: healthy,
    demoEntered: true,
    ...overrides,
  };
}

describe("isAuthenticated", () => {
  it("allows a wallet connected on Testnet with healthy diagnostics", () => {
    expect(isAuthenticated(walletConfig, session())).toBe(true);
  });

  it("allows a demo session once a persona has been entered", () => {
    expect(isAuthenticated(demoConfig, session({ demoEntered: true }))).toBe(true);
  });

  it("blocks demo mode before persona entry", () => {
    expect(isAuthenticated(demoConfig, session({ demoEntered: false }))).toBe(false);
    expect(authenticationBlockReason(demoConfig, session({ demoEntered: false }))).toBe(
      "Choose a demo persona to continue."
    );
  });

  it("blocks wallet mode on the wrong network despite being connected", () => {
    const s = session({ networkAllowed: false });
    expect(isAuthenticated(walletConfig, s)).toBe(false);
    expect(authenticationBlockReason(walletConfig, s)).toBe(
      "Switch Freighter to Stellar Testnet to continue."
    );
  });

  it("blocks wallet mode with failed diagnostics", () => {
    const s = session({ diagnostics: failed });
    expect(isAuthenticated(walletConfig, s)).toBe(false);
    expect(authenticationBlockReason(walletConfig, s)).toBe("RPC unreachable");
  });

  it("blocks wallet mode while diagnostics are still checking", () => {
    const s = session({ diagnostics: null });
    expect(isAuthenticated(walletConfig, s)).toBe(false);
    expect(authenticationBlockReason(walletConfig, s)).toContain("Verifying");
  });

  it("blocks wallet mode when not connected", () => {
    const s = session({ connected: false });
    expect(isAuthenticated(walletConfig, s)).toBe(false);
    expect(authenticationBlockReason(walletConfig, s)).toBe(
      "Connect Freighter to continue."
    );
  });

  it("blocks wallet mode when setup is incomplete", () => {
    const config = { ...walletConfig, walletSetupComplete: false };
    expect(isAuthenticated(config, session())).toBe(false);
    expect(authenticationBlockReason(config, session())).toContain("incomplete");
  });
});