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
