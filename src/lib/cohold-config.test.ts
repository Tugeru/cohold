import { describe, expect, it } from "vitest";
import {
  configuredContractIds,
  isConfiguredWalletTreasury,
  isDemoMutationAllowed,
  resolveCoholdConfig,
  resolveWalletProposalTreasury,
} from "./cohold-config";

const validContractId = `C${"A".repeat(55)}`;
const validTokenId = `C${"B".repeat(55)}`;
const extraContractId = `C${"C".repeat(55)}`;
const extraContractIdTwo = `C${"D".repeat(55)}`;

describe("resolveCoholdConfig", () => {
  it("defaults to demo mode for local development", () => {
    const config = resolveCoholdConfig({});

    expect(config.mode).toBe("demo");
    expect(config.modeConfigured).toBe(true);
    expect(config.walletSetupComplete).toBe(true);
    expect(isDemoMutationAllowed(config)).toBe(true);
  });

  it("fails closed when wallet mode is missing either contract identifier", () => {
    const config = resolveCoholdConfig({
      NEXT_PUBLIC_COHOLD_MODE: "wallet",
      NEXT_PUBLIC_STELLAR_NETWORK: "TESTNET",
      NEXT_PUBLIC_STELLAR_CONTRACT_ID: validContractId,
    });

    expect(config.mode).toBe("wallet");
    expect(config.walletSetupComplete).toBe(false);
    expect(isDemoMutationAllowed(config)).toBe(false);
  });

  it("fails closed for malformed wallet identifiers", () => {
    const config = resolveCoholdConfig({
      NEXT_PUBLIC_COHOLD_MODE: "wallet",
      NEXT_PUBLIC_STELLAR_NETWORK: "TESTNET",
      NEXT_PUBLIC_STELLAR_CONTRACT_ID: "not-a-contract",
      NEXT_PUBLIC_STELLAR_TOKEN_ID: validTokenId,
    });

    expect(config.walletSetupComplete).toBe(false);
    expect(isDemoMutationAllowed(config)).toBe(false);
  });

  it("fails closed when wallet mode is missing the contract identifier", () => {
    const config = resolveCoholdConfig({
      NEXT_PUBLIC_COHOLD_MODE: "wallet",
      NEXT_PUBLIC_STELLAR_NETWORK: "TESTNET",
      NEXT_PUBLIC_STELLAR_TOKEN_ID: validTokenId,
    });

    expect(config.walletSetupComplete).toBe(false);
    expect(isDemoMutationAllowed(config)).toBe(false);
  });

  it("fails closed when wallet mode has a malformed token identifier", () => {
    const config = resolveCoholdConfig({
      NEXT_PUBLIC_COHOLD_MODE: "wallet",
      NEXT_PUBLIC_STELLAR_NETWORK: "TESTNET",
      NEXT_PUBLIC_STELLAR_CONTRACT_ID: validContractId,
      NEXT_PUBLIC_STELLAR_TOKEN_ID: "not-a-token",
    });

    expect(config.walletSetupComplete).toBe(false);
    expect(isDemoMutationAllowed(config)).toBe(false);
  });

  it("keeps wallet writes disabled even when setup identifiers are valid", () => {
    const config = resolveCoholdConfig({
      NEXT_PUBLIC_COHOLD_MODE: "wallet",
      NEXT_PUBLIC_STELLAR_NETWORK: "TESTNET",
      NEXT_PUBLIC_STELLAR_CONTRACT_ID: validContractId,
      NEXT_PUBLIC_STELLAR_TOKEN_ID: validTokenId,
    });

    expect(config.walletSetupComplete).toBe(true);
    expect(isDemoMutationAllowed(config)).toBe(false);
  });

  it("fails closed when wallet mode requests a non-Testnet network", () => {
    const config = resolveCoholdConfig({
      NEXT_PUBLIC_COHOLD_MODE: "wallet",
      NEXT_PUBLIC_STELLAR_NETWORK: "PUBLIC",
      NEXT_PUBLIC_STELLAR_CONTRACT_ID: validContractId,
      NEXT_PUBLIC_STELLAR_TOKEN_ID: validTokenId,
    });

    expect(config.walletSetupComplete).toBe(false);
    expect(isDemoMutationAllowed(config)).toBe(false);
  });

  it("fails closed for an unsupported mode value", () => {
    const config = resolveCoholdConfig({
      NEXT_PUBLIC_COHOLD_MODE: "walet",
    });

    expect(config.modeConfigured).toBe(false);
    expect(isDemoMutationAllowed(config)).toBe(false);
  });
});

describe("configuredContractIds", () => {
  it("lists only the primary contract id by default", () => {
    const config = resolveCoholdConfig({
      NEXT_PUBLIC_COHOLD_MODE: "wallet",
      NEXT_PUBLIC_STELLAR_NETWORK: "TESTNET",
      NEXT_PUBLIC_STELLAR_CONTRACT_ID: validContractId,
      NEXT_PUBLIC_STELLAR_TOKEN_ID: validTokenId,
    });

    expect(configuredContractIds(config)).toEqual([validContractId]);
  });

  it("includes valid optional extra contract ids after the primary", () => {
    const config = resolveCoholdConfig({
      NEXT_PUBLIC_COHOLD_MODE: "wallet",
      NEXT_PUBLIC_STELLAR_NETWORK: "TESTNET",
      NEXT_PUBLIC_STELLAR_CONTRACT_ID: validContractId,
      NEXT_PUBLIC_STELLAR_TOKEN_ID: validTokenId,
      NEXT_PUBLIC_STELLAR_CONTRACT_IDS: `${extraContractId}, ${extraContractIdTwo}`,
    });

    expect(configuredContractIds(config)).toEqual([
      validContractId,
      extraContractId,
      extraContractIdTwo,
    ]);
  });

  it("drops malformed or empty extra ids and normalizes case", () => {
    const config = resolveCoholdConfig({
      NEXT_PUBLIC_COHOLD_MODE: "wallet",
      NEXT_PUBLIC_STELLAR_NETWORK: "TESTNET",
      NEXT_PUBLIC_STELLAR_CONTRACT_ID: validContractId,
      NEXT_PUBLIC_STELLAR_TOKEN_ID: validTokenId,
      NEXT_PUBLIC_STELLAR_CONTRACT_IDS: `not-a-contract, ${extraContractId.toLowerCase()},`,
    });

    expect(configuredContractIds(config)).toEqual([validContractId, extraContractId]);
  });

  it("returns an empty list when setup identifiers are missing", () => {
    const config = resolveCoholdConfig({});

    expect(configuredContractIds(config)).toEqual([]);
  });

  it("deduplicates ids that repeat across variables", () => {
    const config = resolveCoholdConfig({
      NEXT_PUBLIC_COHOLD_MODE: "wallet",
      NEXT_PUBLIC_STELLAR_NETWORK: "TESTNET",
      NEXT_PUBLIC_STELLAR_CONTRACT_ID: validContractId,
      NEXT_PUBLIC_STELLAR_TOKEN_ID: validTokenId,
      NEXT_PUBLIC_STELLAR_CONTRACT_IDS: `${validContractId}, ${extraContractId}`,
    });

    expect(configuredContractIds(config)).toEqual([validContractId, extraContractId]);
  });
});

describe("isConfiguredWalletTreasury", () => {
  it("accepts only ids present in the configured list", () => {
    const config = resolveCoholdConfig({
      NEXT_PUBLIC_COHOLD_MODE: "wallet",
      NEXT_PUBLIC_STELLAR_NETWORK: "TESTNET",
      NEXT_PUBLIC_STELLAR_CONTRACT_ID: validContractId,
      NEXT_PUBLIC_STELLAR_TOKEN_ID: validTokenId,
      NEXT_PUBLIC_STELLAR_CONTRACT_IDS: extraContractId,
    });

    expect(isConfiguredWalletTreasury(config, validContractId)).toBe(true);
    expect(isConfiguredWalletTreasury(config, extraContractId)).toBe(true);
    expect(isConfiguredWalletTreasury(config, extraContractIdTwo)).toBe(false);
    expect(isConfiguredWalletTreasury(config, "tr-it-society-event-fund")).toBe(false);
  });

  it("normalizes case on the requested id", () => {
    const config = resolveCoholdConfig({
      NEXT_PUBLIC_COHOLD_MODE: "wallet",
      NEXT_PUBLIC_STELLAR_NETWORK: "TESTNET",
      NEXT_PUBLIC_STELLAR_CONTRACT_ID: validContractId,
      NEXT_PUBLIC_STELLAR_TOKEN_ID: validTokenId,
    });

    expect(isConfiguredWalletTreasury(config, validContractId.toLowerCase())).toBe(true);
  });
});

describe("resolveWalletProposalTreasury", () => {
  const walletConfig = () =>
    resolveCoholdConfig({
      NEXT_PUBLIC_COHOLD_MODE: "wallet",
      NEXT_PUBLIC_STELLAR_NETWORK: "TESTNET",
      NEXT_PUBLIC_STELLAR_CONTRACT_ID: validContractId,
      NEXT_PUBLIC_STELLAR_TOKEN_ID: validTokenId,
      NEXT_PUBLIC_STELLAR_CONTRACT_IDS: extraContractId,
    });

  it("uses a configured extra contract id from the query param", () => {
    expect(resolveWalletProposalTreasury(walletConfig(), extraContractId)).toBe(
      extraContractId,
    );
  });

  it("falls back to the primary contract without a query param", () => {
    expect(resolveWalletProposalTreasury(walletConfig(), null)).toBe(validContractId);
    expect(resolveWalletProposalTreasury(walletConfig(), undefined)).toBe(validContractId);
  });

  it("ignores query params that are not in the configured list", () => {
    expect(resolveWalletProposalTreasury(walletConfig(), extraContractIdTwo)).toBe(
      validContractId,
    );
    expect(resolveWalletProposalTreasury(walletConfig(), "tr-it-society-event-fund")).toBe(
      validContractId,
    );
  });

  it("normalizes the query param case against the configured list", () => {
    expect(resolveWalletProposalTreasury(walletConfig(), extraContractId.toLowerCase())).toBe(
      extraContractId,
    );
  });

  it("returns null when no contract is configured", () => {
    expect(resolveWalletProposalTreasury(resolveCoholdConfig({}), null)).toBeNull();
  });
});
