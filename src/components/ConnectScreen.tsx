"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { ConnectPanel, PersonaPickList } from "@/components/ConnectPanel";
import { EnvironmentBadge } from "@/components/EnvironmentBadge";
import { useWallet } from "@/context/WalletContext";
import { authenticationBlockReason } from "@/lib/auth-gate";
import { APP_ROUTES } from "@/lib/app-routes";
import { coholdConfig } from "@/lib/cohold-config";
import { RefreshCw } from "lucide-react";

/**
 * Full-screen identity gate for the dashboard shell. Rendered by DemoShell
 * whenever the authentication predicate fails; after a successful connect or
 * persona entry the visitor is routed to /overview.
 */
export function ConnectScreen() {
  const router = useRouter();
  const {
    personas,
    activePersona,
    demoEntered,
    enterDemo,
    connectFreighter,
    walletStatus,
    walletMessage,
    isFreighterConnected,
    isWalletNetworkAllowed,
    walletDiagnostics,
    runWalletDiagnostics,
    walletActionBlockReason,
  } = useWallet();

  const [authRequested, setAuthRequested] = useState(false);

  const blockReason = useMemo(
    () =>
      authenticationBlockReason(coholdConfig, {
        connected: isFreighterConnected,
        networkAllowed: isWalletNetworkAllowed,
        diagnostics: walletDiagnostics,
        demoEntered,
      }),
    [isFreighterConnected, isWalletNetworkAllowed, walletDiagnostics, demoEntered]
  );

  // Both modes land on /overview after entry: demo renders the persona
  // dashboard, wallet mode renders the chain-driven wallet overview.
  const dashboardRoute = APP_ROUTES.overview;

  // Route only after the visitor explicitly asked to connect; a mount-time
  // existing connection or restored session never passes the gate silently.
  useEffect(() => {
    if (authRequested && blockReason === null) router.replace(dashboardRoute);
  }, [authRequested, blockReason, dashboardRoute, router]);

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <BrandMark size={28} />
            <div>
              <div className="text-sm font-bold tracking-tight text-white">Cohold</div>
              <p className="text-[11px] text-slate-400">Shared funds. Shared control.</p>
            </div>
          </div>
          <EnvironmentBadge />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        {coholdConfig.mode === "demo" ? (
          <ConnectPanel
            title="Who are you in this demo?"
            description="Pick the persona you are walking. Personas are demo identities — the wallet stays off-chain."
            status={walletStatus}
            message={null}
            headingLevel="h1"
          >
            <PersonaPickList
              personas={personas}
              activePersona={activePersona}
              onPick={(persona) => {
                setAuthRequested(true);
                enterDemo(persona);
              }}
            />
          </ConnectPanel>
        ) : (
          <ConnectPanel
            title="Connect your wallet"
            description="Cohold runs on Stellar Testnet. Your Freighter address is your identity — treasuries open once it is connected and verified."
            status={walletStatus}
            message={walletMessage ?? walletActionBlockReason}
            headingLevel="h1"
          >
            <button
              type="button"
aria-busy={walletStatus === "connecting" || undefined}
          disabled={walletStatus === "connecting"}
          onClick={() => {
            setAuthRequested(true);
            void connectFreighter();
          }}
              className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60 transition"
            >
              {walletStatus === "connecting" ? "Connecting…" : "Connect Wallet"}
            </button>
            {walletDiagnostics?.status === "failed" && (
              <button
                type="button"
                onClick={() => void runWalletDiagnostics()}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-xs font-semibold text-slate-200 hover:border-slate-500 transition"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Re-run resource checks
              </button>
            )}
            {!isFreighterConnected && (
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Need Freighter? Install the{" "}
                <a
                  href="https://chromewebstore.google.com/detail/freighter/bcacfldlkkdogcmkkibnjlakofdplcbk"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 underline"
                >
                  Freighter extension
                </a>
                , switch it to Testnet, and connect.
              </p>
            )}
          </ConnectPanel>
        )}
      </main>
    </div>
  );
}