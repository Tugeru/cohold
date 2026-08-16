import { describe, expect, it } from "vitest";
import { resourceStateFromResponse } from "./resource-state";

describe("resourceStateFromResponse", () => {
  it("maps a successful payload to ready", () => {
    expect(
      resourceStateFromResponse(
        { ok: true, status: 200 },
        { success: true, treasury: { id: "tr-it" } },
        (body) =>
          body.success === true && body.treasury && typeof body.treasury === "object"
            ? (body.treasury as { id: string })
            : undefined,
      ),
    ).toEqual({ status: "ready", data: { id: "tr-it" } });
  });

  it("maps a missing record to not-found", () => {
    expect(
      resourceStateFromResponse(
        { ok: false, status: 404 },
        { success: false, error: "Treasury not found" },
        () => undefined,
      ),
    ).toEqual({
      status: "not_found",
      message: "Treasury not found",
    });
  });

  it("maps a failed read to a recoverable error", () => {
    expect(
      resourceStateFromResponse(
        { ok: false, status: 500 },
        { success: false, error: "RPC timed out" },
        () => undefined,
      ),
    ).toEqual({
      status: "error",
      message: "RPC timed out",
    });
  });

  it("treats a 200 without the expected record as not-found", () => {
    expect(
      resourceStateFromResponse(
        { ok: true, status: 200 },
        { success: true },
        (body) =>
          body.success === true && body.proposal && typeof body.proposal === "object"
            ? (body.proposal as { id: string })
            : undefined,
      ),
    ).toEqual({
      status: "not_found",
      message: "Not found",
    });
  });
});
