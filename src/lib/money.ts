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
