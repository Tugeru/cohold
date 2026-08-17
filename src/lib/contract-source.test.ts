import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchContractSource } from "./contract-source";

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(body),
  } as Response;
}

describe("fetchContractSource", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the source on a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ success: true, source: "//! Cohold" }))
    );
    await expect(fetchContractSource()).resolves.toBe("//! Cohold");
    expect(fetch).toHaveBeenCalledWith("/api/contract-source", {
      cache: "no-store",
    });
  });

  it("throws the server error message when the read fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ success: false, error: "ENOENT: lib.rs" }, false)
      )
    );
    await expect(fetchContractSource()).rejects.toThrow("ENOENT: lib.rs");
  });

  it("throws a generic error on malformed payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ success: true }))
    );
    await expect(fetchContractSource()).rejects.toThrow(
      "Failed to load contract source"
    );
  });
});