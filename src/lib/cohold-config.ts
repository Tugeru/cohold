import { isValidContractAddress } from "@/lib/stellar";

export type CoholdMode = "demo" | "wallet";

export interface CoholdEnv {
  NEXT_PUBLIC_COHOLD_MODE?: string;
  NEXT_PUBLIC_STELLAR_NETWORK?: string;
  NEXT_PUBLIC_STELLAR_CONTRACT_ID?: string;
  NEXT_PUBLIC_STELLAR_TOKEN_ID?: string;
}

export interface CoholdConfig {
  mode: CoholdMode;
  modeConfigured: boolean;
  network: "TESTNET";
  contractId: string | null;
  tokenId: string | null;
  walletSetupComplete: boolean;
}

function normalizeIdentifier(value: string | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized && isValidContractAddress(normalized) ? normalized : null;
}

export function resolveCoholdConfig(env: CoholdEnv): CoholdConfig {
  const rawMode = env.NEXT_PUBLIC_COHOLD_MODE?.trim().toLowerCase();
  const mode: CoholdMode = rawMode === "wallet" ? "wallet" : "demo";
  const modeConfigured = !rawMode || rawMode === "demo" || rawMode === "wallet";
  const contractId = normalizeIdentifier(env.NEXT_PUBLIC_STELLAR_CONTRACT_ID);
  const tokenId = normalizeIdentifier(env.NEXT_PUBLIC_STELLAR_TOKEN_ID);
  const configuredNetwork = env.NEXT_PUBLIC_STELLAR_NETWORK?.trim().toUpperCase();
  const isTestnet = configuredNetwork === "TESTNET";

  return {
    mode,
    // Cohold's MVP is Testnet-only. Wallet mode requires an explicit network
    // value rather than silently implying a safe target.
    network: "TESTNET",
    contractId,
    tokenId,
    modeConfigured,
    walletSetupComplete:
      modeConfigured && (mode === "demo" || Boolean(isTestnet && contractId && tokenId)),
  };
}

export function isStateChangingAllowed(config: CoholdConfig): boolean {
  // The current wallet shell has no RPC transaction path. Keeping wallet
  // writes disabled prevents fixture DB mutations from masquerading as chain state.
  return config.modeConfigured && config.mode === "demo";
}

// Direct property reads keep NEXT_PUBLIC_* values visible to Next.js's client
// bundle replacement. Local development intentionally defaults to demo mode.
export const coholdConfig = resolveCoholdConfig({
  NEXT_PUBLIC_COHOLD_MODE: process.env.NEXT_PUBLIC_COHOLD_MODE,
  NEXT_PUBLIC_STELLAR_NETWORK: process.env.NEXT_PUBLIC_STELLAR_NETWORK,
  NEXT_PUBLIC_STELLAR_CONTRACT_ID: process.env.NEXT_PUBLIC_STELLAR_CONTRACT_ID,
  NEXT_PUBLIC_STELLAR_TOKEN_ID: process.env.NEXT_PUBLIC_STELLAR_TOKEN_ID,
});

export function getEnvironmentLabel(config: CoholdConfig = coholdConfig): string {
  if (!config.modeConfigured) return "Invalid mode · Setup required";
  return config.mode === "demo" ? "Demo mode · Fixture data" : "Stellar Testnet · Wallet";
}
