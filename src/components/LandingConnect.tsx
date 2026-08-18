"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { connectStatusLabel } from "@/components/ConnectPanel";
import { useWallet } from "@/context/WalletContext";
import { authenticationBlockReason } from "@/lib/auth-gate";
import { APP_ROUTES } from "@/lib/app-routes";
import { coholdConfig } from "@/lib/cohold-config";

/**
 * Identity-first entry on the public landing page — a compact CTA strip, not
 * a card: the hero already has a card on the right, so the connect control
 * stays button-weight. Wallet mode connects Freighter and verifies Testnet;
 * demo mode enters with the selected persona. Routing is armed only by the
 * explicit pick/click, never on mount.
 */
export function LandingConnect() {
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

  useEffect(() => {
    if (authRequested && blockReason === null) router.push(dashboardRoute);
  }, [authRequested, blockReason, dashboardRoute, router]);

  // Keep the hero clean before any interaction: show state feedback only
  // once the visitor acts (connecting, errors, wrong network, connected).
  const showStatus = walletStatus !== "disconnected";
  const statusLabel = showStatus
    ? walletMessage ?? walletActionBlockReason ?? connectStatusLabel(walletStatus, null)
    : null;
  const statusTone =
    walletStatus === "connected"
      ? "text-emerald-400"
      : walletStatus === "connecting"
        ? "text-slate-400"
        : walletStatus === "error" || walletStatus === "wrong-network"
          ? "text-rose-300"
          : "text-slate-400";

  if (coholdConfig.mode === "demo") {
    return (
      <div className="flex flex-col items-start gap-3">
        <label htmlFor="landing-persona" className="text-xs font-semibold text-slate-400">
          Continue as
        </label>
        <select
          id="landing-persona"
          value={activePersona.id}
          onChange={(event) => {
            const persona = personas.find((p) => p.id === event.target.value);
            if (!persona) return;
            setAuthRequested(true);
            enterDemo(persona);
          }}
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:border-slate-500 transition"
        >
          {personas.map((persona) => (
            <option key={persona.id} value={persona.id}>
              {persona.name} — {persona.role}
            </option>
          ))}
        </select>
        <p className="text-xs leading-relaxed text-slate-500">
          Personas simulate multiple members from one browser. Pick one to enter the dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        type="button"
        aria-busy={walletStatus === "connecting" || undefined}
        disabled={walletStatus === "connecting"}
        onClick={() => {
          setAuthRequested(true);
          void connectFreighter();
        }}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60 transition"
      >
        {walletStatus === "connecting" ? "Connecting…" : "Connect Wallet"}
      </button>
      {statusLabel && (
        <p className={`text-xs font-medium ${statusTone}`} role="status">
          {statusLabel}
        </p>
      )}
      {!isFreighterConnected && (
        <p className="text-xs leading-relaxed text-slate-500">
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
    </div>
  );
}