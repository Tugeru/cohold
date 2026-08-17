import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { coholdConfig } from "@/lib/cohold-config";
import { useWallet } from "@/context/WalletContext";
import {
  walletCheckLabel,
  type WalletDiagnosticsResult,
} from "@/lib/wallet-diagnostics";

interface WalletSetupStateProps {
  /**
   * Wallet resource diagnostics from WalletContext. When a check failed,
   * the component renders the unavailable state with the failing checks;
   * omitted or null keeps the static setup-required state.
   */
  diagnostics?: WalletDiagnosticsResult | null;
  onRetry?: () => void;
}

export function WalletSetupState({ diagnostics, onRetry }: WalletSetupStateProps) {
  const isConfigured = coholdConfig.walletSetupComplete;
  const isModeConfigured = coholdConfig.modeConfigured;
  const failed = diagnostics?.status === "failed" && diagnostics.failures.length > 0;

  return (
    <section
      aria-labelledby="wallet-setup-title"
      className="rounded-3xl border border-rose-500/30 bg-rose-950/20 p-8 sm:p-12"
    >
      <div className="mx-auto max-w-xl space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-300">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 id="wallet-setup-title" className="text-xl font-bold text-white">
          {!isModeConfigured
            ? "Invalid Cohold mode configuration"
            : failed
            ? "Configured Testnet treasury unavailable"
            : isConfigured
            ? "Wallet mode is read-only"
            : "Wallet mode setup required"}
        </h1>
        <p className="text-sm leading-relaxed text-slate-300">
          {!isModeConfigured
            ? "NEXT_PUBLIC_COHOLD_MODE must be either demo or wallet. State-changing controls remain disabled until the configuration is corrected."
            : failed
            ? "Stellar Testnet resource checks failed. Contribute, propose, approve, and execute stay disabled until every check passes. Demo fixture treasuries are not shown as a substitute."
            : isConfigured
            ? "The Testnet contract and token identifiers are configured. Create Treasury and demo reset stay in demo mode; wallet-mode creation is out of this change. State-changing controls remain disabled so fixture data cannot be mistaken for chain state."
            : "Cohold is running in wallet mode, but its Testnet contract and token identifiers are not configured. Spending, deposits, proposals, and approvals are disabled until the setup is complete."}
        </p>
        {failed && (
          <ul className="space-y-2 text-left">
            {diagnostics.failures.map((failure) => (
              <li
                key={`${failure.id}-${failure.contractId ?? ""}`}
                className="rounded-xl border border-rose-500/20 bg-slate-950 p-3"
              >
                <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-300">
                  {walletCheckLabel(failure.id)}
                  {failure.contractId ? (
                    <span className="ml-2 font-mono normal-case text-slate-500">
                      {failure.contractId.slice(0, 10)}…
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-xs leading-relaxed text-slate-300">{failure.message}</div>
              </li>
            ))}
          </ul>
        )}
        {failed && onRetry ? (
          <button
            onClick={() => void onRetry()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/20"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Re-check Testnet resources
          </button>
        ) : null}
        {!isModeConfigured ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-left font-mono tabular-nums text-xs text-slate-300">
            <div className="text-slate-500">Accepted mode values</div>
            <div className="mt-2">NEXT_PUBLIC_COHOLD_MODE=demo</div>
            <div>NEXT_PUBLIC_COHOLD_MODE=wallet</div>
          </div>
        ) : !isConfigured && !failed && (
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-left font-mono tabular-nums text-xs text-slate-300">
            <div className="text-slate-500">Required environment</div>
            <div className="mt-2">NEXT_PUBLIC_STELLAR_CONTRACT_ID</div>
            <div>NEXT_PUBLIC_STELLAR_TOKEN_ID</div>
            <div className="mt-3 text-slate-500">
              {coholdConfig.network} only; restart the dev server after editing .env.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Fail-closed gate shared by every wallet-mode view: returns the setup/
 * unavailable state whenever wallet setup is incomplete or a resource check
 * failed, and null when the view may render chain data.
 */
export function useWalletResourceGate(): ReactNode {
  const { walletDiagnostics, runWalletDiagnostics } = useWallet();
  if (!coholdConfig.walletSetupComplete || walletDiagnostics?.status === "failed") {
    return (
      <WalletSetupState diagnostics={walletDiagnostics} onRetry={runWalletDiagnostics} />
    );
  }
  return null;
}