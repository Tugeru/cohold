import type { CoholdRpc } from "@/lib/contract-adapter";
import {
  type CoholdConfig,
  configuredContractIds,
} from "@/lib/cohold-config";

// ---------------------------------------------------------------------------
// Fail-closed wallet diagnostics. Wallet mode is trusted only after every
// check here passes; any failure disables state-changing actions and renders
// the configured Testnet treasury unavailable instead of demo fixtures.
// ---------------------------------------------------------------------------

export type WalletCheckId = "network" | "rpc" | "contract" | "token" | "readable";

export interface WalletCheckFailure {
  id: WalletCheckId;
  /** Contract the failure applies to, when the check is per-treasury. */
  contractId?: string;
  message: string;
}

export type WalletDiagnosticsResult =
  | { status: "healthy"; checkedContractIds: string[] }
  | { status: "failed"; failures: WalletCheckFailure[] };

export interface WalletDiagnosticsDeps {
  config: CoholdConfig;
  rpc: CoholdRpc;
}

const CHECK_LABELS: Record<WalletCheckId, string> = {
  network: "Testnet-only",
  rpc: "RPC reachable",
  contract: "Cohold contract",
  token: "Token match",
  readable: "Members, threshold, balance",
};

export function walletCheckLabel(id: WalletCheckId): string {
  return CHECK_LABELS[id];
}

export function firstFailureMessage(result: WalletDiagnosticsResult | null): string | null {
  if (result?.status !== "failed" || result.failures.length === 0) return null;
  return result.failures[0].message;
}

async function readOrNull<T>(read: () => Promise<T | null>): Promise<T | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

const RPC_HEALTH_MAX_ATTEMPTS = 2;

async function probeRpcHealth(rpc: CoholdRpc): Promise<boolean> {
  for (let attempt = 0; attempt < RPC_HEALTH_MAX_ATTEMPTS; attempt += 1) {
    const healthy = await readOrNull(() => rpc.getHealth());
    if (healthy === true) return true;
  }
  return false;
}

/**
 * Run every wallet resource check and collect all failures. A healthy result
 * means: config is wallet-mode Testnet, the RPC endpoint is reachable, every
 * configured contract answers a Cohold-shaped `get_config`, each contract's
 * on-chain token equals the configured token, and members/threshold/balance
 * are readable for each contract.
 */
export async function diagnoseWalletResources(
  deps: WalletDiagnosticsDeps,
): Promise<WalletDiagnosticsResult> {
  const { config, rpc } = deps;
  const failures: WalletCheckFailure[] = [];
  const contractIds = configuredContractIds(config);

  if (config.mode !== "wallet" || config.network !== "TESTNET" || !config.walletSetupComplete) {
    failures.push({
      id: "network",
      message:
        "Cohold is Testnet-only. Wallet mode requires NEXT_PUBLIC_STELLAR_NETWORK=TESTNET plus the contract and token identifiers.",
    });
  }

  const rpcHealthy = await probeRpcHealth(rpc);
  if (rpcHealthy !== true) {
    failures.push({
      id: "rpc",
      message:
        "Stellar RPC is unreachable or did not report a healthy node. Check the network connection or NEXT_PUBLIC_STELLAR_RPC_URL.",
    });
  }

  for (const contractId of contractIds) {
    const chainConfig = await readOrNull(() => rpc.getConfig(contractId));
    if (chainConfig === null) {
      failures.push({
        id: "contract",
        contractId,
        message: `Contract ${contractId} is not initialized or is not a Cohold treasury on this network.`,
      });
      // Token and readability checks depend on a parsed config; skip them
      // for this contract and report the shape failure.
      continue;
    }

    const configuredToken = config.tokenId?.toUpperCase() ?? null;
    const chainToken = chainConfig.tokenAddress.toUpperCase();
    if (configuredToken === null || chainToken !== configuredToken) {
      failures.push({
        id: "token",
        contractId,
        message: `Contract ${contractId} holds ${chainToken}, but ${configuredToken ?? "no token"} is configured.`,
      });
    }

    const members = await readOrNull(() => rpc.getMemberList(contractId));
    const balance = await readOrNull(() => rpc.getBalance(contractId));
    if (members === null || balance === null) {
      failures.push({
        id: "readable",
        contractId,
        message: `Members, threshold, or balance could not be read for contract ${contractId}.`,
      });
    }
  }

  if (failures.length === 0) {
    return { status: "healthy", checkedContractIds: contractIds };
  }
  return { status: "failed", failures };
}