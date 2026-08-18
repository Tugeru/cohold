import type { CoholdConfig } from "@/lib/cohold-config";
import {
  firstFailureMessage,
  type WalletDiagnosticsResult,
} from "@/lib/wallet-diagnostics";

/**
 * Identity state the auth gate reads. Wallet mode is authenticated only when
 * Freighter is connected, on Stellar Testnet, and wallet resource diagnostics
 * are healthy; demo mode is authenticated once a persona has been entered for
 * the current browser session.
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
 * Precedence mirrors the wallet action gate: setup incomplete -> diagnostics
 * failed -> diagnostics checking -> not connected -> wrong network.
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
  if (session.diagnostics?.status === "failed") {
    return (
      firstFailureMessage(session.diagnostics) ??
      "Wallet resource checks failed; the dashboard is unavailable."
    );
  }
  if (session.diagnostics === null) {
    return "Verifying Stellar Testnet resources…";
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