import type { CoholdConfig } from "@/lib/cohold-config";
import { configuredContractIds } from "@/lib/cohold-config";
import { isValidContractAddress } from "@/lib/stellar";

// ---------------------------------------------------------------------------
// Client-side registry of treasuries created in-app. The chain is the only
// source of truth for treasury state; this registry exists so the UI knows
// which contract ids to read without an env edit or server restart. Env-
// configured treasuries and registered ones are merged wherever the wallet
// surfaces read contract ids.
// ---------------------------------------------------------------------------

export interface RegisteredTreasury {
  id: string;
  name: string;
  createdAt: number;
}

const STORAGE_KEY = "cohold.registeredTreasuries";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRegisteredTreasuryRecord(value: unknown): value is RegisteredTreasury {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    isValidContractAddress(record.id) &&
    typeof record.name === "string" &&
    typeof record.createdAt === "number"
  );
}

export function readRegisteredTreasuries(): RegisteredTreasury[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRegisteredTreasuryRecord);
  } catch {
    return [];
  }
}

export function registeredTreasuryIds(): string[] {
  return readRegisteredTreasuries().map((treasury) => treasury.id);
}

export function registerTreasury(registration: { id: string; name: string }): void {
  const store = storage();
  if (!store) return;
  const id = registration.id?.trim().toUpperCase();
  if (!isValidContractAddress(id)) return;
  const next = [
    ...readRegisteredTreasuries().filter((treasury) => treasury.id !== id),
    {
      id,
      name: registration.name.trim().slice(0, 80),
      createdAt: Date.now(),
    },
  ];
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full/unavailable: the treasury still exists on-chain; the
    // env-configured list keeps rendering.
  }
}

export function isRegisteredTreasury(id: string | null | undefined): boolean {
  const requested = id?.trim().toUpperCase();
  return Boolean(requested && registeredTreasuryIds().includes(requested));
}

/** Every treasury the wallet UI reads: env-configured plus locally created. */
export function walletTreasuryContractIds(config: CoholdConfig): string[] {
  return [...new Set([...configuredContractIds(config), ...registeredTreasuryIds()])];
}

/** Configured or locally created treasury? Drives detail/proposal routing. */
export function isKnownWalletTreasury(
  config: CoholdConfig,
  id: string | null | undefined,
): boolean {
  const requested = id?.trim().toUpperCase();
  return Boolean(requested && walletTreasuryContractIds(config).includes(requested));
}

/**
 * Resolve which treasury a wallet-mode proposal belongs to, including
 * locally created ones. A `treasury` query param wins only when it names a
 * known contract id; otherwise the primary env contract is used.
 */
export function resolveWalletTreasuryForProposal(
  config: CoholdConfig,
  treasuryParam: string | undefined | null,
): string | null {
  if (isKnownWalletTreasury(config, treasuryParam)) {
    return treasuryParam!.trim().toUpperCase();
  }
  return config.contractId;
}
