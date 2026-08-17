import { describe, expect, it } from "vitest";
import {
  IDENTITIES,
  TREASURIES,
  buildManifest,
  parseJsonValue,
} from "./testnet-bootstrap.mjs";

const SAC_ID = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const G = (n) => `G${String(n).padStart(55, "0")}`;

describe("treasury specs", () => {
  it("provisions exactly the two issue treasuries with fixed names", () => {
    expect(TREASURIES.map((t) => t.key)).toEqual(["A", "B"]);
    expect(TREASURIES.map((t) => t.name)).toEqual([
      "IT Society Event Fund",
      "Capstone Project Fund",
    ]);
  });

  it("A has members A-D with threshold 3", () => {
    const a = TREASURIES[0];
    expect(a.members).toEqual([
      "memberA",
      "memberB",
      "memberC",
      "memberD",
    ]);
    expect(a.threshold).toBe(3);
  });

  it("B is independent of A (members and threshold differ)", () => {
    const [a, b] = TREASURIES;
    expect(b.members).not.toEqual(a.members);
    expect(b.threshold).not.toBe(a.threshold);
    expect(b.threshold).toBe(2);
  });

  it("creators are members and thresholds are valid for every treasury", () => {
    for (const t of TREASURIES) {
      expect(t.members).toContain(t.creator);
      expect(t.threshold).toBeGreaterThan(0);
      expect(t.threshold).toBeLessThanOrEqual(t.members.length);
    }
  });
});

describe("identities", () => {
  it("covers deployer, members A-D, recipient, and outsider", () => {
    expect(Object.keys(IDENTITIES).sort()).toEqual([
      "deployer",
      "memberA",
      "memberB",
      "memberC",
      "memberD",
      "outsider",
      "recipient",
    ]);
  });

  it("names are unique CLI keyring identifiers", () => {
    const names = Object.values(IDENTITIES);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name.startsWith("cohold-")).toBe(true);
    }
  });
});

describe("parseJsonValue", () => {
  it("parses scalar CLI outputs (i128 values print as JSON strings)", () => {
    expect(parseJsonValue('"0"')).toBe("0");
    expect(parseJsonValue("true")).toBe(true);
    expect(parseJsonValue("null")).toBeNull();
  });

  it("parses pretty-printed objects and arrays", () => {
    expect(
      parseJsonValue('{\n  "creator": "G1",\n  "threshold": 3\n}'),
    ).toEqual({ creator: "G1", threshold: 3 });
    expect(parseJsonValue('["G1", "G2"]')).toEqual(["G1", "G2"]);
  });

  it("throws on non-JSON CLI output", () => {
    expect(() => parseJsonValue("error: boom")).toThrow(/no JSON value/);
  });
});

describe("manifest", () => {
  const prefix = (n) => `C${String(n).padStart(55, "0")}`;

  it("records every acceptance field with no secret material", () => {
    const manifest = buildManifest({
      rpc: "https://soroban-testnet.stellar.org/",
      tokenId: SAC_ID,
      gitSha: "a3ac561",
      wasmSha256: "ab".repeat(32),
      timestamp: "2026-08-18T00:00:00.000Z",
      identities: {
        deployer: G(1),
        memberA: G(2),
        memberB: G(3),
        memberC: G(4),
        memberD: G(5),
        recipient: G(6),
        outsider: G(7),
      },
      treasuries: [
        {
          key: "A",
          name: "IT Society Event Fund",
          id: prefix(1),
          creator: G(2),
          members: [G(2), G(3), G(4), G(5)],
          threshold: 3,
        },
        {
          key: "B",
          name: "Capstone Project Fund",
          id: prefix(2),
          creator: G(3),
          members: [G(3), G(4), G(5)],
          threshold: 2,
        },
      ],
    });

    for (const field of [
      "network",
      "rpc",
      "asset",
      "tokenId",
      "gitSha",
      "wasmSha256",
      "timestamp",
    ]) {
      expect(manifest[field]).toBeDefined();
    }
    expect(manifest.network).toBe("testnet");
    expect(manifest.asset).toBe("native");
    expect(manifest.tokenId).toBe(SAC_ID);
    expect(manifest.treasuries).toHaveLength(2);
    expect(manifest.identities.deployer).toBe(G(1));
    expect(manifest.treasuries[0].id).toBe(prefix(1));

    // Secrets never ship: no private keys, seeds, or recovery phrases.
    expect(JSON.stringify(manifest)).not.toMatch(
      /secret|seed|private|phrase/i,
    );
  });
});