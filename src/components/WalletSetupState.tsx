import { AlertTriangle } from "lucide-react";
import { coholdConfig } from "@/lib/cohold-config";

export function WalletSetupState() {
  const isConfigured = coholdConfig.walletSetupComplete;
  const isModeConfigured = coholdConfig.modeConfigured;

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
            : isConfigured
            ? "Wallet mode is read-only"
            : "Wallet mode setup required"}
        </h1>
        <p className="text-sm leading-relaxed text-slate-300">
          {!isModeConfigured
            ? "NEXT_PUBLIC_COHOLD_MODE must be either demo or wallet. State-changing controls remain disabled until the configuration is corrected."
            : isConfigured
            ? "The Testnet contract and token identifiers are configured. Create Treasury and demo reset stay in demo mode; wallet-mode creation is out of this change. State-changing controls remain disabled so fixture data cannot be mistaken for chain state."
            : "Cohold is running in wallet mode, but its Testnet contract and token identifiers are not configured. Spending, deposits, proposals, and approvals are disabled until the setup is complete."}
        </p>
        {!isModeConfigured ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-left font-mono tabular-nums text-xs text-slate-300">
            <div className="text-slate-500">Accepted mode values</div>
            <div className="mt-2">NEXT_PUBLIC_COHOLD_MODE=demo</div>
            <div>NEXT_PUBLIC_COHOLD_MODE=wallet</div>
          </div>
        ) : !isConfigured && (
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
