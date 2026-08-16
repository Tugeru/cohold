import { describe, expect, it } from "vitest";
import {
  isStateChangingAllowed,
  resolveCoholdConfig,
} from "./cohold-config";

const validContractId = `C${"A".repeat(55)}`;
const validTokenId = `C${"B".repeat(55)}`;

describe("resolveCoholdConfig", () => {
  it("defaults to demo mode for local development", () => {
    const config = resolveCoholdConfig({});

    expect(config.mode).toBe("demo");
    expect(config.modeConfigured).toBe(true);
    expect(config.walletSetupComplete).toBe(true);
    expect(isStateChangingAllowed(config)).toBe(true);
  });

  it("fails closed when wallet mode is missing either contract identifier", () => {
    const config = resolveCoholdConfig({
      NEXT_PUBLIC_COHOLD_MODE: "wallet",
      NEXT_PUBLIC_STELLAR_NETWORK: "TESTNET",
      NEXT_PUBLIC_STELLAR_CONTRACT_ID: validContractId,
    });

    expect(config.mode).toBe("wallet");
    expect(config.walletSetupComplete).toBe(false);
    expect(isStateChangingAllowed(config)).toBe(false);
  });

  it("fails closed for malformed wallet identifiers", () => {
    const config = resolveCoholdConfig({
      NEXT_PUBLIC_COHOLD_MODE: "wallet",
      NEXT_PUBLIC_STELLAR_NETWORK: "TESTNET",
      NEXT_PUBLIC_STELLAR_CONTRACT_ID: "not-a-contract",
      NEXT_PUBLIC_STELLAR_TOKEN_ID: validTokenId,
    });

    expect(config.walletSetupComplete).toBe(false);
    expect(isStateChangingAllowed(config)).toBe(false);
  });

  it("fails closed when wallet mode is missing the contract identifier", () => {
    const config = resolveCoholdConfig({
      NEXT_PUBLIC_COHOLD_MODE: "wallet",
      NEXT_PUBLIC_STELLAR_NETWORK: "TESTNET",
      NEXT_PUBLIC_STELLAR_TOKEN_ID: validTokenId,
    });

    expect(config.walletSetupComplete).toBe(false);
    expect(isStateChangingAllowed(config)).toBe(false);
  });

  it("fails closed when wallet mode has a malformed token identifier", () => {
    const config = resolveCoholdConfig({
      NEXT_PUBLIC_COHOLD_MODE: "wallet",
      NEXT_PUBLIC_STELLAR_NETWORK: "TESTNET",
      NEXT_PUBLIC_STELLAR_CONTRACT_ID: validContractId,
      NEXT_PUBLIC_STELLAR_TOKEN_ID: "not-a-token",
    });

    expect(config.walletSetupComplete).toBe(false);
    expect(isStateChangingAllowed(config)).toBe(false);
  });

  it("keeps wallet writes disabled even when setup identifiers are valid", () => {
    const config = resolveCoholdConfig({
      NEXT_PUBLIC_COHOLD_MODE: "wallet",
      NEXT_PUBLIC_STELLAR_NETWORK: "TESTNET",
      NEXT_PUBLIC_STELLAR_CONTRACT_ID: validContractId,
      NEXT_PUBLIC_STELLAR_TOKEN_ID: validTokenId,
    });

    expect(config.walletSetupComplete).toBe(true);
    expect(isStateChangingAllowed(config)).toBe(false);
  });

  it("fails closed when wallet mode requests a non-Testnet network", () => {
    const config = resolveCoholdConfig({
      NEXT_PUBLIC_COHOLD_MODE: "wallet",
      NEXT_PUBLIC_STELLAR_NETWORK: "PUBLIC",
      NEXT_PUBLIC_STELLAR_CONTRACT_ID: validContractId,
      NEXT_PUBLIC_STELLAR_TOKEN_ID: validTokenId,
    });

    expect(config.walletSetupComplete).toBe(false);
    expect(isStateChangingAllowed(config)).toBe(false);
  });

  it("fails closed for an unsupported mode value", () => {
    const config = resolveCoholdConfig({
      NEXT_PUBLIC_COHOLD_MODE: "walet",
    });

    expect(config.modeConfigured).toBe(false);
    expect(isStateChangingAllowed(config)).toBe(false);
  });
});
