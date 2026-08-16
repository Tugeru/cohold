import * as freighter from "@stellar/freighter-api";
import {
  isValidStellarAddress,
  STELLAR_TESTNET_NETWORK_PASSPHRASE,
} from "@/lib/stellar";

export { STELLAR_TESTNET_NETWORK_PASSPHRASE };

export type FreighterError = {
  message?: string;
  name?: string;
  code?: string | number;
};

export interface FreighterApi {
  isConnected: () => Promise<{
    isConnected: boolean;
    error?: FreighterError;
  }>;
  requestAccess: () => Promise<{
    address: string;
    error?: FreighterError;
  }>;
  getAddress: () => Promise<{
    address: string;
    error?: FreighterError;
  }>;
  getNetwork: () => Promise<{
    network: string;
    networkPassphrase: string;
    error?: FreighterError;
  }>;
  signTransaction: (
    transactionXdr: string,
    options: { networkPassphrase: string; address?: string }
  ) => Promise<{
    signedTxXdr: string;
    signerAddress: string;
    error?: FreighterError;
  }>;
}

type WalletNetwork = {
  network: string;
  networkPassphrase: string;
};

export type WalletConnectionResult =
  | ({ status: "connected"; address: string } & WalletNetwork)
  | ({ status: "wrong-network"; address: string } & WalletNetwork)
  | { status: "cancelled" | "not-installed" | "error"; message: string };

export type WalletSignatureResult =
  | { status: "signed"; signedTxXdr: string; signerAddress: string }
  | ({ status: "wrong-network" } & WalletNetwork)
  | { status: "cancelled" | "not-connected" | "error"; message: string };

type WalletNetworkError = {
  status: "cancelled" | "error";
  message: string;
};

function getErrorMessage(error: FreighterError | undefined): string {
  return error?.message?.trim() || "Freighter request failed";
}

function isCancelledError(error: FreighterError | undefined): boolean {
  const description = `${error?.name ?? ""} ${error?.code ?? ""} ${
    error?.message ?? ""
  }`.toLowerCase();
  return /(cancel|reject|declin|denied|closed|abort)/.test(description);
}

function failedResult(
  error: FreighterError | undefined,
  fallback: string
): WalletNetworkError {
  if (isCancelledError(error)) {
    return { status: "cancelled" as const, message: fallback };
  }
  return { status: "error" as const, message: getErrorMessage(error) };
}

function networkResult(address: string, network: WalletNetwork): WalletConnectionResult {
  if (network.networkPassphrase !== STELLAR_TESTNET_NETWORK_PASSPHRASE) {
    return { status: "wrong-network", address, ...network };
  }
  return { status: "connected", address, ...network };
}

async function readNetwork(api: FreighterApi): Promise<WalletNetwork | WalletNetworkError> {
  try {
    const result = await api.getNetwork();
    if (result.error) return failedResult(result.error, "Network check cancelled");
    if (!result.network || !result.networkPassphrase) {
      return {
        status: "error",
        message: "Freighter did not return its network",
      } satisfies WalletNetworkError;
    }
    return {
      network: result.network,
      networkPassphrase: result.networkPassphrase,
    };
  } catch (error: unknown) {
    const freighterError = error as FreighterError;
    return failedResult(freighterError, "Network check cancelled");
  }
}

function isNetworkError(
  value: WalletNetwork | WalletNetworkError
): value is WalletNetworkError {
  return "status" in value;
}

export async function connectFreighter(
  api: FreighterApi = freighter as unknown as FreighterApi
): Promise<WalletConnectionResult> {
  try {
    const access = await api.requestAccess();
    if (access.error) return failedResult(access.error, "Wallet connection cancelled");
    if (!isValidStellarAddress(access.address)) {
      return { status: "error", message: "Freighter returned an invalid public address" };
    }

    const network = await readNetwork(api);
    if (isNetworkError(network)) return network;
    return networkResult(access.address, network);
  } catch (error: unknown) {
    return failedResult(error as FreighterError, "Wallet connection cancelled");
  }
}

export async function restoreFreighter(
  api: FreighterApi = freighter as unknown as FreighterApi
): Promise<WalletConnectionResult> {
  try {
    const connection = await api.isConnected();
    if (connection.error || !connection.isConnected) {
      return { status: "not-installed", message: "Freighter wallet is not connected" };
    }

    const addressResult = await api.getAddress();
    if (addressResult.error) return failedResult(addressResult.error, "Wallet connection cancelled");
    if (!isValidStellarAddress(addressResult.address)) {
      return { status: "error", message: "Freighter returned an invalid public address" };
    }

    const network = await readNetwork(api);
    if (isNetworkError(network)) return network;
    return networkResult(addressResult.address, network);
  } catch (error: unknown) {
    return failedResult(error as FreighterError, "Wallet connection cancelled");
  }
}

export async function signFreighterTransaction(
  transactionXdr: string,
  api: FreighterApi = freighter as unknown as FreighterApi,
  expectedAddress?: string
): Promise<WalletSignatureResult> {
  const network = await readNetwork(api);
  if (isNetworkError(network)) {
    if (network.status === "cancelled") {
      return { status: "cancelled", message: "Signature cancelled" };
    }
    return network;
  }
  if (network.networkPassphrase !== STELLAR_TESTNET_NETWORK_PASSPHRASE) {
    return { status: "wrong-network", ...network };
  }

  try {
    const result = await api.signTransaction(transactionXdr, {
      networkPassphrase: STELLAR_TESTNET_NETWORK_PASSPHRASE,
      address: expectedAddress,
    });
    if (result.error) return failedResult(result.error, "Signature cancelled");
    if (!result.signedTxXdr || !result.signerAddress) {
      return { status: "error", message: "Freighter returned an empty signature" };
    }
    if (
      expectedAddress &&
      result.signerAddress.toUpperCase() !== expectedAddress.toUpperCase()
    ) {
      return { status: "error", message: "Freighter signed with a different address" };
    }
    return {
      status: "signed",
      signedTxXdr: result.signedTxXdr,
      signerAddress: result.signerAddress,
    };
  } catch (error: unknown) {
    return failedResult(error as FreighterError, "Signature cancelled");
  }
}
