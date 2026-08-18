import { describe, expect, it } from "vitest";
import {
  REQUIRED_TESTNET_SECRETS,
  resolveMatrixGate,
} from "./testnet-matrix-gate";

const SECRET = "SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"; // well-formed (all zeros)
const ID_A = "CCYKPLZE4OT7LIBUPWRQ4UGARQTOVBORYLV3ZQIKSKVI77Z5JVV3CVR2";
const ID_B = "CABEVCDWFZ2W4W3H75T3DIOTEGHAVEPM2KETRROZNVHT2OVGUV4UVCYZ";
const TOKEN = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

const FULL_ENV = Object.fromEntries(
  REQUIRED_TESTNET_SECRETS.map((name) => [name, SECRET]),
);

const FULL_IDS = { contractIdA: ID_A, contractIdB: ID_B, tokenId: TOKEN };

function problems(env: Record<string, string | undefined> = FULL_ENV, ids = FULL_IDS): string[] {
  return resolveMatrixGate(env, ids).problems;
}

describe("resolveMatrixGate", () => {
  it("enables only when every secret and id is present and well-formed", () => {
    const gate = resolveMatrixGate(FULL_ENV, FULL_IDS);
    expect(gate.enabled).toBe(true);
    expect(gate.problems).toEqual([]);
  });

  it("disables when any secret is missing", () => {
    for (const name of REQUIRED_TESTNET_SECRETS) {
      const env = { ...FULL_ENV };
      delete env[name];
      const problemsFor = problems(env);
      expect(problemsFor).toContain(`${name} is missing`);
      expect(resolveMatrixGate(env, FULL_IDS).enabled).toBe(false);
    }
  });

  it("disables on blank secret values", () => {
    const env = { ...FULL_ENV, COHOLD_TESTNET_SECRET_B: "   " };
    expect(resolveMatrixGate(env, FULL_IDS).enabled).toBe(false);
  });

  it("disables on malformed secret values", () => {
    const env = { ...FULL_ENV, COHOLD_TESTNET_SECRET_C: "not-a-secret" };
    const gate = resolveMatrixGate(env, FULL_IDS);
    expect(gate.enabled).toBe(false);
    expect(gate.problems).toContain("COHOLD_TESTNET_SECRET_C is not a valid Stellar secret key");
  });

  it("disables on malformed or duplicate ids", () => {
    expect(
      resolveMatrixGate(FULL_ENV, { ...FULL_IDS, contractIdA: "CX" }).problems,
    ).toContain("contractIdA is not a valid Soroban contract id");
    expect(
      resolveMatrixGate(FULL_ENV, { ...FULL_IDS, tokenId: "" }).problems,
    ).toContain("tokenId is not a valid Soroban contract id");
    const duplicate = resolveMatrixGate(FULL_ENV, { ...FULL_IDS, contractIdB: ID_A });
    expect(duplicate.enabled).toBe(false);
    expect(duplicate.problems).toContain(
      "contractIdA and contractIdB must be different treasuries",
    );
  });

  it("lists every problem at once instead of failing on the first", () => {
    const gate = resolveMatrixGate({}, { contractIdA: "CX", contractIdB: "CY", tokenId: "" });
    expect(gate.enabled).toBe(false);
    expect(gate.problems).toHaveLength(REQUIRED_TESTNET_SECRETS.length + 3);
  });
});