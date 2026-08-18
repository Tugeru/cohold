import { isValidContractAddress, STELLAR_TESTNET_RPC_URL } from "@/lib/stellar";

export type CoholdMode = "demo" | "wallet";

export interface CoholdEnv {
  NEXT_PUBLIC_COHOLD_MODE?: string;
  NEXT_PUBLIC_STELLAR_NETWORK?: string;
  NEXT_PUBLIC_STELLAR_CONTRACT_ID?: string;
  NEXT_PUBLIC_STELLAR_CONTRACT_IDS?: string;
  NEXT_PUBLIC_STELLAR_TOKEN_ID?: string;
  NEXT_PUBLIC_STELLAR_RPC_URL?: string;
  NEXT_PUBLIC_COHOLD_FACTORY_ID?: string;
}

export interface CoholdConfig {
  mode: CoholdMode;
  modeConfigured: boolean;
  network: "TESTNET";
  contractId: string | null;
  /** Optional additional treasury contracts shown in wallet mode. */
  extraContractIds: string[];
  tokenId: string | null;
  /**
   * CoholdFactory contract id. When configured, the create-treasury flow
   * deploys through the factory (one signature) and factory-created
   * treasuries are discoverable on every device via `get_treasuries`.
   */
  factoryId: string | null;
  /**
   * RPC endpoint override, or null for the public Testnet default. Only
   * http(s) URLs are accepted; anything else parses to null so the wallet
   * diagnostics fail closed instead of silently using a junk endpoint.
   */
  rpcUrl: string | null;
  walletSetupComplete: boolean;
}

function normalizeIdentifier(value: string | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized && isValidContractAddress(normalized) ? normalized : null;
}

function normalizeIdentifierList(value: string | undefined): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const raw of value.split(",")) {
    const id = raw.trim().toUpperCase();
    if (id && isValidContractAddress(id) && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/** Wallet-mode treasuries: the primary env contract plus optional extras. */
export function configuredContractIds(config: CoholdConfig): string[] {
  if (!config.contractId) return [];
  return [...new Set([config.contractId, ...config.extraContractIds])];
}

export function isConfiguredWalletTreasury(
  config: CoholdConfig,
  id: string | undefined | null,
): boolean {
  const requested = id?.trim().toUpperCase();
  return Boolean(requested && configuredContractIds(config).includes(requested));
}

/** The CoholdFactory contract id, or null when not configured. */
export function configuredFactoryId(config: CoholdConfig): string | null {
  return config.factoryId;
}

/**
 * Resolve which configured treasury a wallet-mode proposal belongs to. A
 * `treasury` query param wins only when it names a configured contract ID;
 * otherwise the primary env contract is used. Returns null when wallet mode
 * has no configured contract (never under wallet setup, but safe regardless).
 */
export function resolveWalletProposalTreasury(
  config: CoholdConfig,
  treasuryParam: string | undefined | null,
): string | null {
  if (isConfiguredWalletTreasury(config, treasuryParam)) {
    return treasuryParam!.trim().toUpperCase();
  }
  return config.contractId;
}

export function resolveCoholdConfig(env: CoholdEnv): CoholdConfig {
  const rawMode = env.NEXT_PUBLIC_COHOLD_MODE?.trim().toLowerCase();
  const mode: CoholdMode = rawMode === "wallet" ? "wallet" : "demo";
  const modeConfigured = !rawMode || rawMode === "demo" || rawMode === "wallet";
  const contractId = normalizeIdentifier(env.NEXT_PUBLIC_STELLAR_CONTRACT_ID);
  const tokenId = normalizeIdentifier(env.NEXT_PUBLIC_STELLAR_TOKEN_ID);
  const factoryId = normalizeIdentifier(env.NEXT_PUBLIC_COHOLD_FACTORY_ID);
  const extraContractIds = normalizeIdentifierList(env.NEXT_PUBLIC_STELLAR_CONTRACT_IDS);
  const configuredNetwork = env.NEXT_PUBLIC_STELLAR_NETWORK?.trim().toUpperCase();
  const isTestnet = configuredNetwork === "TESTNET";
  const rawRpcUrl = env.NEXT_PUBLIC_STELLAR_RPC_URL?.trim();
  const rpcUrl =
    rawRpcUrl && /^https?:\/\/.+/.test(rawRpcUrl) ? rawRpcUrl : null;

  return {
    mode,
    // Cohold's MVP is Testnet-only. Wallet mode requires an explicit network
    // value rather than silently implying a safe target.
    network: "TESTNET",
    contractId,
    extraContractIds,
    tokenId,
    factoryId,
    rpcUrl,
    modeConfigured,
    walletSetupComplete:
      modeConfigured && (mode === "demo" || Boolean(isTestnet && contractId && tokenId)),
  };
}

export function isDemoMutationAllowed(config: CoholdConfig): boolean {
  // Fixture/DB mutations are demo-mode only. Wallet mode must never write
  // demo fixtures, personas, or synthetic hashes into wallet state, even
  // when contract/token IDs are configured.
  return config.modeConfigured && config.mode === "demo";
}

// Direct property reads keep NEXT_PUBLIC_* values visible to Next.js's client
// bundle replacement. Local development intentionally defaults to demo mode.
export const coholdConfig = resolveCoholdConfig({
  NEXT_PUBLIC_COHOLD_MODE: process.env.NEXT_PUBLIC_COHOLD_MODE,
  NEXT_PUBLIC_STELLAR_NETWORK: process.env.NEXT_PUBLIC_STELLAR_NETWORK,
  NEXT_PUBLIC_STELLAR_CONTRACT_ID: process.env.NEXT_PUBLIC_STELLAR_CONTRACT_ID,
  NEXT_PUBLIC_STELLAR_CONTRACT_IDS: process.env.NEXT_PUBLIC_STELLAR_CONTRACT_IDS,
  NEXT_PUBLIC_STELLAR_TOKEN_ID: process.env.NEXT_PUBLIC_STELLAR_TOKEN_ID,
  NEXT_PUBLIC_STELLAR_RPC_URL: process.env.NEXT_PUBLIC_STELLAR_RPC_URL,
  NEXT_PUBLIC_COHOLD_FACTORY_ID: process.env.NEXT_PUBLIC_COHOLD_FACTORY_ID,
});

/**
 * Effective RPC endpoint for wallet-mode reads: the configured override when
 * valid, otherwise the public Testnet default.
 */
export function configuredRpcUrl(config: CoholdConfig = coholdConfig): string {
  return config.rpcUrl ?? STELLAR_TESTNET_RPC_URL;
}

export function getEnvironmentLabel(config: CoholdConfig = coholdConfig): string {
  if (!config.modeConfigured) return "Invalid mode · Setup required";
  return config.mode === "demo" ? "Demo mode · Fixture data" : "Stellar Testnet · Wallet";
}
