import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveCoholdConfig } from "./cohold-config";
import {
  DEMO_FIXTURES,
  DEMO_MUTATION_ERROR,
  DEMO_PERSONAS,
  DEMO_RESET_MESSAGE,
  demoMutationDenied,
  demoPersonas,
  initialDemoActor,
  resetDemoFixtures,
  resolveDemoActor,
  syntheticDemoSuccess,
} from "./demo-adapter";

const validContractId = `C${"A".repeat(55)}`;
const validTokenId = `C${"B".repeat(55)}`;

const demoConfig = resolveCoholdConfig({});
const walletConfig = resolveCoholdConfig({
  NEXT_PUBLIC_COHOLD_MODE: "wallet",
  NEXT_PUBLIC_STELLAR_NETWORK: "TESTNET",
  NEXT_PUBLIC_STELLAR_CONTRACT_ID: validContractId,
  NEXT_PUBLIC_STELLAR_TOKEN_ID: validTokenId,
});

const maria = "GD7VXZK2PZ4O4NKL66S5YEM53H7M2T4YV77LQO7JEQN2J3QZ5XG6P4RD";
const juan = "GB2YQK3XW5U7M9N1P3R5T7V9X1Z3B5D7F9H1J3L5N7P9R1T3V5X7Z9B1";
const outsider = "GAVENUE999HOTELCENTRALHALLTESTNETRECIPIENT1";

const mutationRoutes = [
  "src/app/api/stellar/reset-demo/route.ts",
  "src/app/api/treasuries/route.ts",
  "src/app/api/treasuries/[id]/contribute/route.ts",
  "src/app/api/treasuries/[id]/proposals/route.ts",
  "src/app/api/proposals/[id]/approve/route.ts",
  "src/app/api/proposals/[id]/execute/route.ts",
  "src/app/api/proposals/[id]/cancel/route.ts",
] as const;

describe("demo adapter mode gate", () => {
  it("allows fixture mutations only in demo mode", () => {
    expect(demoMutationDenied(demoConfig)).toBeNull();
  });

  it("returns a clear mode error for wallet-mode posts before any write", async () => {
    let wrote = false;
    const denied = demoMutationDenied(walletConfig);
    const result = await resetDemoFixtures(walletConfig, async () => {
      wrote = true;
    });

    expect(denied).toEqual({ success: false, error: DEMO_MUTATION_ERROR });
    expect(result).toEqual({ ok: false, error: DEMO_MUTATION_ERROR });
    expect(wrote).toBe(false);
    expect(DEMO_MUTATION_ERROR.toLowerCase()).toContain("demo mode");
  });

  it("exposes fixture personas only in demo mode", () => {
    expect(demoPersonas(demoConfig)).toEqual(DEMO_PERSONAS);
    expect(demoPersonas(walletConfig)).toEqual([]);
    expect(initialDemoActor(demoConfig).id).toBe("maria-president");
    expect(initialDemoActor(walletConfig).address).toBe("");
    expect(DEMO_PERSONAS.map((persona) => persona.address)).not.toContain(
      initialDemoActor(walletConfig).address
    );
    expect(initialDemoActor(walletConfig).id).not.toBe(DEMO_PERSONAS[0].id);
  });
});

describe("demo reset", () => {
  it("restores the documented fixture set and states no Testnet balance changed", async () => {
    let restored = false;
    const result = await resetDemoFixtures(demoConfig, async () => {
      restored = true;
    });

    expect(restored).toBe(true);
    expect(result).toEqual({ ok: true, message: DEMO_RESET_MESSAGE });
    expect(DEMO_RESET_MESSAGE).toMatch(/no testnet balance changed/i);
    expect(DEMO_FIXTURES.treasuryId).toBe("tr-it-society-event-fund");
    expect(DEMO_FIXTURES.venueProposal).toEqual({
      id: "prop-venue-deposit-4500",
      amount: "4500",
      approvalCount: 2,
      threshold: 3,
    });
    expect(DEMO_PERSONAS.map((persona) => persona.id)).toContain("maria-president");
  });

  it("rejects wallet-mode reset and does not write DB or contract state", async () => {
    let restored = false;
    const result = await resetDemoFixtures(walletConfig, async () => {
      restored = true;
    });

    expect(restored).toBe(false);
    expect(result).toEqual({ ok: false, error: DEMO_MUTATION_ERROR });
  });
});

describe("request-body fields are not authorization", () => {
  it("rejects an altered actor even when a signature is supplied", () => {
    const result = resolveDemoActor({
      actorAddress: outsider,
      signature: "sig_ed25519_forged_soroban_auth",
      label: "President",
      members: [maria, juan],
    });

    expect(result).toEqual({
      allowed: false,
      reason: "Address is not a member of this treasury",
    });
  });

  it("records a member actor without treating signature or label as authorization", () => {
    const result = resolveDemoActor({
      actorAddress: maria,
      signature: "sig_ed25519_forged_soroban_auth",
      label: "Forged signer",
      members: [maria, juan],
    });

    expect(result).toEqual({ allowed: true, actorAddress: maria });
  });

  it("issues synthetic demo success that does not look like Soroban authorization", () => {
    const success = syntheticDemoSuccess();

    expect(success.txHash).toMatch(/^[0-9a-f]{64}$/);
    expect(success.proof).toBe("demo-synthetic");
    expect(JSON.stringify(success).toLowerCase()).not.toMatch(/soroban|signature|auth_pass/);
  });
});

describe("mutation routes stay demo-scoped", () => {
  it.each(mutationRoutes)("gates %s before any DB write", (path) => {
    const source = readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
    const gateIdx = source.search(/demoMutationDenied|resetDemoFixtures/);
    const writeIdx = source.search(/db\.(insert|update|delete)/);

    expect(gateIdx).toBeGreaterThan(-1);
    expect(source).not.toContain("Wallet mode setup is incomplete");
    if (writeIdx !== -1) {
      expect(gateIdx).toBeLessThan(writeIdx);
    }
  });

  it("does not store a request-body signature as Soroban authorization", () => {
    const approve = readFileSync(
      new URL("../../src/app/api/proposals/[id]/approve/route.ts", import.meta.url),
      "utf8"
    );
    expect(approve).toContain("resolveDemoActor");
    expect(approve).toContain("syntheticDemoSuccess");
    expect(approve).not.toMatch(/signature\s*\|\|/);
    expect(approve).not.toContain("sig_soroban_auth");
  });

  it.each(mutationRoutes.filter((path) => path !== "src/app/api/stellar/reset-demo/route.ts"))(
    "issues synthetic success through the adapter in %s",
    (path) => {
      const source = readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
      expect(source).toContain("syntheticDemoSuccess");
      expect(source).not.toContain("generateStellarTxHash");
    }
  );

  it("keeps GET /api/treasuries as a read path", () => {
    const source = readFileSync(
      new URL("../../src/app/api/treasuries/route.ts", import.meta.url),
      "utf8"
    );
    const getBlock = source.slice(source.indexOf("export async function GET"), source.indexOf("export async function POST"));
    expect(getBlock).not.toContain("demoMutationDenied");
  });
});

describe("fixture personas are adapter-sourced", () => {
  it("routes UI and seed consumers through the demo adapter", () => {
    const walletContext = readFileSync(
      new URL("../../src/context/WalletContext.tsx", import.meta.url),
      "utf8"
    );
    const createTreasury = readFileSync(
      new URL("../../src/components/CreateTreasuryModal.tsx", import.meta.url),
      "utf8"
    );
    const seed = readFileSync(new URL("./db-seed.ts", import.meta.url), "utf8");

    expect(walletContext).toContain("demoPersonas");
    expect(walletContext).toContain("initialDemoActor");
    expect(walletContext).toContain("@/lib/demo-adapter");
    expect(walletContext).not.toContain("DEMO_PERSONAS");
    expect(walletContext).not.toContain("@/lib/personas");
    expect(createTreasury).toContain("DEMO_PERSONAS");
    expect(createTreasury).toContain("@/lib/demo-adapter");
    expect(createTreasury).not.toContain("@/lib/personas");
    expect(seed).toContain("DEMO_PERSONAS");
    expect(seed).toContain("./demo-adapter");
  });
});
