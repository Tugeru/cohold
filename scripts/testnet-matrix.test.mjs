import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REQUIRED_SECRETS, resolveMatrixEnv } from "./testnet-matrix.mjs";

/** A manifest-shaped fixture mirroring deployments/testnet.json. */
const MANIFEST = {
  tokenId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  treasuries: [
    { key: "A", id: "CCYKPLZE4OT7LIBUPWRQ4UGARQTOVBORYLV3ZQIKSKVI77Z5JVV3CVR2" },
    { key: "B", id: "CABEVCDWFZ2W4W3H75T3DIOTEGHAVEPM2KETRROZNVHT2OVGUV4UVCYZ" },
  ],
};
const SECRETS = Object.fromEntries(
  REQUIRED_SECRETS.map((key) => [key, `S${"A".repeat(55)}`]),
);

describe("testnet matrix env resolution", () => {
  it("requires every COHOLD_TESTNET secret and names each missing one", () => {
    const resolution = resolveMatrixEnv({}, "/nonexistent");
    expect(resolution.ok).toBe(false);
    expect(resolution.env).toBeNull();
    for (const key of REQUIRED_SECRETS) {
      expect(resolution.errors.join("\n")).toContain(key);
    }
    expect(resolution.errors[0]).toContain("non-public");
  });

  it("treats empty-string secrets as missing", () => {
    const env = Object.fromEntries(REQUIRED_SECRETS.map((key) => [key, "  "]));
    expect(resolveMatrixEnv(env, "/nonexistent").ok).toBe(false);
  });

  it("rejects malformed secrets even when every name is present", () => {
    const env = { ...SECRETS, COHOLD_TESTNET_SECRET_A: "not-a-secret" };
    const resolution = resolveMatrixEnv(env, manifestPath(MANIFEST));
    expect(resolution.ok).toBe(false);
    expect(resolution.errors.join("\n")).toContain(
      "COHOLD_TESTNET_SECRET_A",
    );
    expect(resolution.errors.join("\n")).toContain("Malformed Testnet secrets");
  });

  it("defaults contract ids to the public manifest", () => {
    const resolution = resolveMatrixEnv({ ...SECRETS }, "/tmp/nope");
    // no manifest → ids unresolved
    expect(resolution.ok).toBe(false);
    const withManifest = resolveMatrixEnv(SECRETS, manifestPath(MANIFEST));
    expect(withManifest.ok).toBe(true);
    expect(withManifest.env.contractIdA).toBe(MANIFEST.treasuries[0].id);
    expect(withManifest.env.contractIdB).toBe(MANIFEST.treasuries[1].id);
    expect(withManifest.env.tokenId).toBe(MANIFEST.tokenId);
    expect(withManifest.env.resolvedSecretCount).toBe(REQUIRED_SECRETS.length);
  });

  it("lets env overrides win over the manifest and normalizes case", () => {
    const overrideA = "CA" + "A".repeat(54);
    const resolution = resolveMatrixEnv(
      {
        ...SECRETS,
        COHOLD_TESTNET_CONTRACT_ID: `c${overrideA.slice(1).toLowerCase()}`,
      },
      manifestPath(MANIFEST),
    );
    expect(resolution.ok).toBe(true);
    expect(resolution.env.contractIdA).toBe(overrideA);
  });

  it("rejects malformed or duplicate contract ids even with secrets set", () => {
    const badId = resolveMatrixEnv(
      { ...SECRETS, COHOLD_TESTNET_CONTRACT_ID: "not-a-contract" },
      manifestPath(MANIFEST),
    );
    expect(badId.ok).toBe(false);
    expect(badId.errors.join("\n")).toContain("contract id");

    const duplicate = resolveMatrixEnv({ ...SECRETS }, manifestPath({
      ...MANIFEST,
      treasuries: [
        { key: "A", id: MANIFEST.treasuries[0].id },
        { key: "B", id: MANIFEST.treasuries[0].id },
      ],
    }));
    expect(duplicate.ok).toBe(false);
    expect(duplicate.errors.join("\n")).toContain("different contracts");
  });

  it("refuses to run when the manifest is unreadable and no ids are set", () => {
    const resolution = resolveMatrixEnv(SECRETS, "/definitely/not/here.json");
    expect(resolution.ok).toBe(false);
    expect(resolution.env).toBeNull();
  });

  it("resolves secrets and ids independently", () => {
    const resolution = resolveMatrixEnv({ COHOLD_TESTNET_SECRET_A: "S".repeat(56) }, manifestPath(MANIFEST));
    expect(resolution.ok).toBe(false);
    expect(resolution.errors.join("\n")).toContain("COHOLD_TESTNET_SECRET_B");
  });
});

/** Write a manifest fixture to a temp file and return its path. */
function manifestPath(manifest) {
  const dir = mkdtempSync(join(tmpdir(), "cohold-matrix-"));
  const file = join(dir, "testnet.json");
  writeFileSync(file, JSON.stringify(manifest));
  return file;
}