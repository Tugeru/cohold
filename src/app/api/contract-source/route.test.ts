import { afterEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { GET } from "./route";

vi.mock("node:fs/promises", () => ({ readFile: vi.fn() }));
vi.mock("node:path", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:path")>()),
  join: vi.fn(() => "/repo/contracts/cohold/src/lib.rs"),
}));

describe("GET /api/contract-source", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the crate source as { success, source }", async () => {
    vi.mocked(readFile).mockResolvedValue("//! Cohold" as never);
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      source: "//! Cohold",
    });
  });

  it("returns 500 with the read error when the file is missing", async () => {
    vi.mocked(readFile).mockRejectedValue(new Error("ENOENT: lib.rs"));
    const res = await GET();
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      success: false,
      error: "ENOENT: lib.rs",
    });
  });
});