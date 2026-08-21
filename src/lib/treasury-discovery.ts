import type { CoholdConfig } from "@/lib/cohold-config";
import { configuredFactoryId } from "@/lib/cohold-config";
import { STELLAR_TESTNET_NETWORK_PASSPHRASE } from "@/lib/stellar";
import { Client as FactoryClient } from "cohold-factory-contract";

// ---------------------------------------------------------------------------
// Factory-backed treasury discovery. Treasuries created through the
// CoholdFactory contract are listed by `factory.get_treasuries()`, which any
// device can read. The wallet views merge those ids with the env-configured
// and locally registered ones, so a treasury created from one browser shows
// up for the same wallet (and co-members) on any other device.
//
// Discovery is a read-only RPC call; failures fail open to the current
// cache (env + registered ids still render). The cache is populated lazily
// by the views via `ensureFactoryTreasuryDiscovery` and refreshed on every
// wallet-address change.
// ---------------------------------------------------------------------------

let cachedFactoryIds: string[] = [];
let inFlight: Promise<string[]> | null = null;

/** Factory-created treasury ids discovered so far (env/registered ids are separate). */
export function factoryTreasuryIds(): string[] {
  return cachedFactoryIds;
}

/**
 * Ensure factory treasury ids have been fetched. Resolves with the ids
 * (possibly [] when the factory is not configured, discovery fails, or the
 * wallet is not connected). The fetch is shared, so any number of views can
 * await the same discovery.
 */
export function ensureFactoryTreasuryDiscovery(
  config: CoholdConfig,
  publicKey: string | null | undefined,
  rpcUrl: string,
): Promise<string[]> {
  const factoryId = configuredFactoryId(config);
  if (!factoryId || !publicKey) return Promise.resolve(cachedFactoryIds);
  if (inFlight) return inFlight;
  inFlight = loadFactoryTreasuries(factoryId, publicKey, rpcUrl)
    .then((ids) => {
      cachedFactoryIds = ids;
      return ids;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Force a fresh factory discovery (e.g. Refresh button) — always refetches. */
export function refreshFactoryTreasuryDiscovery(
  config: CoholdConfig,
  publicKey: string | null | undefined,
  rpcUrl: string,
): Promise<string[]> {
  const factoryId = configuredFactoryId(config);
  if (!factoryId || !publicKey) return Promise.resolve(cachedFactoryIds);
  // Drop any in-flight coalescing so Refresh is not swallowed by a prior
  // failed/empty fetch that is still settling.
  inFlight = loadFactoryTreasuries(factoryId, publicKey, rpcUrl)
    .then((ids) => {
      cachedFactoryIds = ids;
      return ids;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Test seam — reset discovery cache. */
export function __resetFactoryDiscoveryForTests(): void {
  cachedFactoryIds = [];
  inFlight = null;
}

async function loadFactoryTreasuries(
  factoryId: string,
  publicKey: string,
  rpcUrl: string,
): Promise<string[]> {
  try {
    const client = new FactoryClient({
      contractId: factoryId,
      rpcUrl,
      networkPassphrase: STELLAR_TESTNET_NETWORK_PASSPHRASE,
      publicKey,
    });
    const tx = await client.get_treasuries();
    const simulation = tx.simulation as { error?: unknown } | undefined;
    if (
      simulation &&
      typeof simulation.error === "string" &&
      simulation.error.length > 0
    ) {
      return [];
    }
    const ids = tx.result ?? [];
    return ids.filter((id) => /^C[A-Z2-7]{55}$/.test(id));
  } catch {
    // Discovery is best-effort: env-configured and locally registered
    // treasuries keep rendering even when the factory read fails.
    return [];
  }
}
