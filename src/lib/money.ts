export type BaseUnitInput = string | number | bigint;

const INTEGER_STRING = /^[0-9]+$/;

function parseInteger(input: unknown): bigint {
  if (typeof input === "bigint") {
    return input;
  }

  if (typeof input === "number") {
    if (!Number.isSafeInteger(input)) {
      throw new Error("Amount must be a safe integer base-unit value");
    }
    return BigInt(input);
  }

  if (typeof input === "string") {
    const normalized = input.trim();
    if (!INTEGER_STRING.test(normalized)) {
      throw new Error("Amount must be an integer base-unit value");
    }
    return BigInt(normalized);
  }

  throw new Error("Amount must be an integer base-unit value");
}

/**
 * Parse an amount at the contract seam. Zero, negative, fractional, and
 * malformed values are rejected before a transaction can be constructed.
 */
export function parseBaseUnits(input: unknown): bigint {
  const units = parseInteger(input);
  if (units <= 0n) {
    throw new Error("Amount must be greater than zero base units");
  }
  return units;
}

/** Parse a balance or optional seed amount where zero is valid. */
export function parseNonNegativeBaseUnits(input: unknown): bigint {
  const units = parseInteger(input);
  if (units < 0n) {
    throw new Error("Amount cannot be negative base units");
  }
  return units;
}

export function formatBaseUnits(input: BaseUnitInput): string {
  return parseNonNegativeBaseUnits(input).toLocaleString("en-US");
}

const HUMAN_AMOUNT = /^[0-9]+(\.[0-9]+)?$/;

/**
 * Parse a user-typed human amount ("12.5") into integer base units using the
 * asset's decimals. String math only: the authoritative result never passes
 * through a float. Zero, negative, malformed, and over-precise input is
 * rejected before a transaction can be constructed.
 */
export function parseHumanAmountToBaseUnits(
  input: unknown,
  decimals: number,
): bigint {
  const raw = typeof input === "string" ? input.trim() : "";
  const safeDecimals = Number.isSafeInteger(decimals) && decimals >= 0 ? decimals : 0;
  if (!raw || !HUMAN_AMOUNT.test(raw)) {
    throw new Error(
      `Amount must be a number with up to ${safeDecimals} decimal places`,
    );
  }
  const [whole = "", fraction = ""] = raw.split(".");
  if (fraction.length > safeDecimals) {
    throw new Error(
      `Amount cannot have more than ${safeDecimals} decimal places for this asset`,
    );
  }
  const units = BigInt(`${whole}${fraction.padEnd(safeDecimals, "0")}`);
  if (units <= 0n) {
    throw new Error("Amount must be greater than zero");
  }
  return units;
}

/**
 * Format integer base units using the asset's decimals without ever
 * converting the authoritative amount through a float. Display-only.
 */
export function formatBaseAmount(
  input: BaseUnitInput,
  decimals: number,
  symbol = "",
): string {
  const units = parseNonNegativeBaseUnits(input);
  const safeDecimals = Number.isSafeInteger(decimals) && decimals >= 0 ? decimals : 0;
  const padded = units.toString().padStart(safeDecimals + 1, "0");
  const whole =
    safeDecimals === 0 ? padded : padded.slice(0, -safeDecimals) || "0";
  const fraction =
    safeDecimals === 0 ? "" : padded.slice(-safeDecimals).replace(/0+$/, "");
  const label =
    // Regex grouping on the digit string: safe for i128-scale amounts that
    // Number would round above 2^53.
    whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (fraction ? `.${fraction}` : "");
  return symbol ? `${label} ${symbol}` : label;
}
