import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveCoholdConfig } from "./cohold-config";
import {
  isKnownWalletTreasury,
  isRegisteredTreasury,
  readRegisteredTreasuries,
  registerTreasury,
  resolveWalletTreasuryForProposal,
  walletTreasuryContractIds,
} from "./treasury-registry";

const CONTRACT = `C${"A".repeat(55)}`;
const EXTRA = `C${"B".repeat(55)}`;
const REGISTERED = `C${"C".repeat(55)}`;
const OTHER = `C${"D".repeat(55)}`;

function walletConfig() {
  return resolveCoholdConfig({
    NEXT_PUBLIC_COHOLD_MODE: "wallet",
    NEXT_PUBLIC_STELLAR_NETWORK: "TESTNET",
    NEXT_PUBLIC_STELLAR_CONTRACT_ID: CONTRACT,
    NEXT_PUBLIC_STELLAR_CONTRACT_IDS: EXTRA,
    NEXT_PUBLIC_STELLAR_TOKEN_ID: `C${"E".repeat(55)}`,
  });
}

function storageStub(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => void data.delete(key),
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("treasury registry (no window)", () => {
  it("reads nothing and registers nothing without a browser", () => {
    expect(readRegisteredTreasuries()).toEqual([]);
    registerTreasury({ id: REGISTERED, name: "Trip Fund" });
    expect(readRegisteredTreasuries()).toEqual([]);
    expect(walletTreasuryContractIds(walletConfig())).toEqual([CONTRACT, EXTRA]);
  });
});

describe("treasury registry (with window)", () => {
  it("persists registrations in creation order", () => {
    vi.stubGlobal("window", { localStorage: storageStub() });
    registerTreasury({ id: REGISTERED, name: "Trip Fund" });
    registerTreasury({ id: OTHER, name: "Rent Pool" });
    const registered = readRegisteredTreasuries();
    expect(registered).toHaveLength(2);
    expect(registered.map((t) => t.id)).toEqual([REGISTERED, OTHER]);
    expect(registered[0]).toMatchObject({ id: REGISTERED, name: "Trip Fund" });
  });

  it("normalizes ids, ignores invalid ids, and dedupes on re-register", () => {
    vi.stubGlobal("window", { localStorage: storageStub() });
    registerTreasury({ id: REGISTERED.toLowerCase(), name: "Trip Fund" });
    registerTreasury({ id: "not-a-contract", name: "Junk" });
    registerTreasury({ id: REGISTERED, name: "Renamed" });
    const registered = readRegisteredTreasuries();
    expect(registered).toHaveLength(1);
    expect(registered[0]).toMatchObject({ id: REGISTERED, name: "Renamed" });
  });

  it("merges registered ids after env-configured ids without duplicates", () => {
    vi.stubGlobal("window", { localStorage: storageStub() });
    registerTreasury({ id: REGISTERED, name: "Trip Fund" });
    registerTreasury({ id: EXTRA, name: "Env duplicate" });
    expect(walletTreasuryContractIds(walletConfig())).toEqual([
      CONTRACT,
      EXTRA,
      REGISTERED,
    ]);
  });

  it("ignores corrupted storage", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => "{not json",
        setItem: () => undefined,
      } as unknown as Storage,
    });
    expect(readRegisteredTreasuries()).toEqual([]);
  });
});

describe("wallet treasury routing", () => {
  it("recognizes env-configured and registered treasuries", () => {
    vi.stubGlobal("window", { localStorage: storageStub() });
    registerTreasury({ id: REGISTERED, name: "Trip Fund" });
    expect(isKnownWalletTreasury(walletConfig(), CONTRACT)).toBe(true);
    expect(isKnownWalletTreasury(walletConfig(), EXTRA)).toBe(true);
    expect(isKnownWalletTreasury(walletConfig(), REGISTERED)).toBe(true);
    expect(isKnownWalletTreasury(walletConfig(), OTHER)).toBe(false);
    expect(isKnownWalletTreasury(walletConfig(), "tr-something")).toBe(false);
  });

  it("isRegisteredTreasury only accepts registered ids", () => {
    vi.stubGlobal("window", { localStorage: storageStub() });
    registerTreasury({ id: REGISTERED, name: "Trip Fund" });
    expect(isRegisteredTreasury(REGISTERED)).toBe(true);
    expect(isRegisteredTreasury(REGISTERED.toLowerCase())).toBe(true);
    expect(isRegisteredTreasury(CONTRACT)).toBe(false);
    expect(isRegisteredTreasury(null)).toBe(false);
  });

  it("resolveWalletTreasuryForProposal prefers a known query param", () => {
    vi.stubGlobal("window", { localStorage: storageStub() });
    registerTreasury({ id: REGISTERED, name: "Trip Fund" });
    expect(resolveWalletTreasuryForProposal(walletConfig(), REGISTERED)).toBe(REGISTERED);
    expect(resolveWalletTreasuryForProposal(walletConfig(), EXTRA)).toBe(EXTRA);
    expect(resolveWalletTreasuryForProposal(walletConfig(), REGISTERED.toLowerCase())).toBe(
      REGISTERED,
    );
    expect(resolveWalletTreasuryForProposal(walletConfig(), null)).toBe(CONTRACT);
    expect(resolveWalletTreasuryForProposal(walletConfig(), OTHER)).toBe(CONTRACT);
    expect(resolveWalletTreasuryForProposal(walletConfig(), "tr-something")).toBe(CONTRACT);
  });
});
