import type { CoholdConfig } from "@/lib/cohold-config";
import type { WalletDiagnosticsResult } from "@/lib/wallet-diagnostics";

/**
 * Identity state the auth gate reads. Wallet mode is authenticated when
 * Freighter is connected on Stellar Testnet (and setup is complete). Contract
 * health (walletDiagnostics) is a per-view concern owned by
 * useWalletResourceGate — the shell gate must not re-ask for wallet after
 * the user is already connected on Testnet just because RPC probes are
 * pending or failed.
 */
export interface AuthSession {
  connected: boolean;
  networkAllowed: boolean;
  diagnostics: WalletDiagnosticsResult | null;
  demoEntered: boolean;
}

/**
 * Mode-aware identity predicate. A null block reason means the dashboard is
 * reachable; anything else explains why the visitor is on the connect screen.
 * ponytail: diagnostics stays non-blocking at the shell — per-view gate shows
 * WalletSetupState with retry; add diagnostics back here only if you truly
 * want the whole dashboard gated on contract health (then update repro +
 * WalletSetupState split).
 */
export function authenticationBlockReason(
  config: CoholdConfig,
  session: AuthSession,
): string | null {
  if (config.mode === "demo") {
    return session.demoEntered ? null : "Choose a demo persona to continue.";
  }

  if (!config.walletSetupComplete) {
    return "Wallet setup is incomplete; the Testnet contract and token identifiers must be configured.";
  }
  if (!session.connected) {
    return "Connect Freighter to continue.";
  }
  if (!session.networkAllowed) {
    return "Switch Freighter to Stellar Testnet to continue.";
  }
  return null;
}

export function isAuthenticated(
  config: CoholdConfig,
  session: AuthSession,
): boolean {
  return authenticationBlockReason(config, session) === null;
}