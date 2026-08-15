export const STELLAR_TESTNET_HORIZON_URL =
  "https://horizon-testnet.stellar.org";
export const STELLAR_TESTNET_RPC_URL =
  "https://soroban-testnet.stellar.org";
export const STELLAR_TESTNET_NETWORK_PASSPHRASE =
  "Test SDF Network ; September 2015";

export interface AccountBalance {
  asset_type: string;
  asset_code?: string;
  balance: string;
}

export function isValidStellarAddress(address: string): boolean {
  if (!address || typeof address !== "string") return false;
  // Stellar public key (Ed25519) format starts with 'G' and is 56 characters long, base32 encoded
  return /^G[A-Z2-7]{55}$/.test(address.trim());
}

export function isValidContractAddress(address: string): boolean {
  if (!address || typeof address !== "string") return false;
  // Soroban contract address starts with 'C' and is 56 characters
  return /^C[A-Z2-7]{55}$/.test(address.trim());
}

export function getStellarExpertUrl(
  type: "account" | "tx" | "contract",
  identifier: string,
  network = "testnet"
): string {
  return `https://stellar.expert/explorer/${network}/${type}/${identifier}`;
}

export async function requestFriendbotFunding(
  publicKey: string
): Promise<{ success: boolean; message: string; txHash?: string }> {
  try {
    const res = await fetch(
      `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`
    );
    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        message: "Successfully funded 10,000 Testnet XLM via Friendbot!",
        txHash: data.hash || data.id,
      };
    } else {
      const errText = await res.text();
      return {
        success: false,
        message: `Friendbot response: ${errText.slice(0, 150)}`,
      };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown network error";
    return {
      success: false,
      message: `Friendbot network error: ${message}`,
    };
  }
}

export async function fetchStellarAccountBalances(
  publicKey: string
): Promise<AccountBalance[]> {
  try {
    const res = await fetch(
      `${STELLAR_TESTNET_HORIZON_URL}/accounts/${publicKey}`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.balances || [];
  } catch {
    return [];
  }
}
