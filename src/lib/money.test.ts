import { describe, expect, it } from "vitest";
import {
  formatBaseAmount,
  parseBaseUnits,
  parseHumanAmountToBaseUnits,
} from "./money";

describe("parseHumanAmountToBaseUnits", () => {
  it("converts a human amount to integer base units using decimals", () => {
    expect(parseHumanAmountToBaseUnits("0.5", 7)).toBe(5_000_000n);
    expect(parseHumanAmountToBaseUnits("1", 7)).toBe(10_000_000n);
    expect(parseHumanAmountToBaseUnits("1.0000000", 7)).toBe(10_000_000n);
    expect(parseHumanAmountToBaseUnits("0042.0000000", 7)).toBe(420_000_000n);
  });

  it("supports zero-decimal assets", () => {
    expect(parseHumanAmountToBaseUnits("42", 0)).toBe(42n);
  });

  it("rejects zero, negative, malformed, and over-precise input", () => {
    expect(() => parseHumanAmountToBaseUnits("0", 7)).toThrow();
    expect(() => parseHumanAmountToBaseUnits("0.0000000", 7)).toThrow();
    expect(() => parseHumanAmountToBaseUnits("-1", 7)).toThrow();
    expect(() => parseHumanAmountToBaseUnits("abc", 7)).toThrow();
    expect(() => parseHumanAmountToBaseUnits("1.", 7)).toThrow();
    expect(() => parseHumanAmountToBaseUnits(".5", 7)).toThrow();
    expect(() => parseHumanAmountToBaseUnits("1,5", 7)).toThrow();
    expect(() => parseHumanAmountToBaseUnits("1e3", 7)).toThrow();
    expect(() => parseHumanAmountToBaseUnits("1.00000001", 7)).toThrow();
    expect(() => parseHumanAmountToBaseUnits("  ", 7)).toThrow();
  });

  it("keeps i128-scale amounts exact above 2^53", () => {
    expect(parseHumanAmountToBaseUnits("9007199254740993", 0)).toBe(9_007_199_254_740_993n);
  });
});

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

describe("formatBaseAmount", () => {
  it("formats base units with decimals without floating point", () => {
    expect(formatBaseAmount("10000000000", 7, "USDC")).toBe("1,000 USDC");
    expect(formatBaseAmount("4500000000", 7, "USDC")).toBe("450 USDC");
  });

  it("strips trailing zeros in the fractional part", () => {
    expect(formatBaseAmount("4500000000", 7)).toBe("450");
    expect(formatBaseAmount("10000000", 7)).toBe("1");
    expect(formatBaseAmount("1", 7)).toBe("0.0000001");
  });

  it("handles zero and small balances", () => {
    expect(formatBaseAmount("0", 7, "USDC")).toBe("0 USDC");
    expect(formatBaseAmount(5n, 7, "USDC")).toBe("0.0000005 USDC");
  });

  it("handles zero decimals (integer assets)", () => {
    expect(formatBaseAmount("42", 0, "XLM")).toBe("42 XLM");
  });

  it("groups i128-scale amounts without Number rounding above 2^53", () => {
    expect(formatBaseAmount("123456789012345678901", 0, "XLM")).toBe(
      "123,456,789,012,345,678,901 XLM",
    );
    expect(formatBaseAmount("9007199254740993", 7, "XLM")).toBe(
      "900,719,925.4740993 XLM",
    );
  });

  it("rejects negative or malformed input", () => {
    expect(() => formatBaseAmount("-1", 7)).toThrow();
    expect(() => formatBaseAmount("1.5", 7)).toThrow();
  });
});
