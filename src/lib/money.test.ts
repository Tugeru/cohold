import { describe, expect, it } from "vitest";
import { parseBaseUnits } from "./money";

describe("parseBaseUnits", () => {
  it("accepts a positive integer string as bigint base units", () => {
    expect(parseBaseUnits("4500")).toBe(4500n);
  });

  it.each(["", "0", "-1", "1.5", "1e3", "not-a-number", "  "]) (
    "rejects malformed or non-positive input %j",
    (input) => {
      expect(() => parseBaseUnits(input)).toThrow();
    }
  );

  it("rejects unsafe or fractional JavaScript numbers", () => {
    expect(() => parseBaseUnits(1.5)).toThrow();
    expect(() => parseBaseUnits(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });
});
