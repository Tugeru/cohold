"use client";

import React, { useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { formatAddress } from "@/lib/utils";
import { getStellarExpertUrl } from "@/lib/stellar";
import {
  Wallet,
  ShieldCheck,
  Zap,
  Copy,
  Check,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
  Lock,
  Layers,
  Radio,
  Sliders,
} from "lucide-react";

interface WalletSettingsViewProps {
  onResetDemo: () => Promise<void>;
}

export function WalletSettingsView({ onResetDemo }: WalletSettingsViewProps) {
  const {
    activePersona,
    setActivePersona,
    personas,
    testnetBalance,
    refreshBalance,
    connectFreighter,
    isFreighterConnected,
    disconnectFreighter,
  } = useWallet();

  const [copied, setCopied] = useState(false);
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetMsg, setFaucetMsg] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(activePersona.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFaucet = async () => {
    setFaucetLoading(true);
    setFaucetMsg(null);
    try {
      const res = await fetch("/api/stellar/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: activePersona.address }),
      });
      const data = await res.json();
      if (data.success) {
        setFaucetMsg("10,000 Testnet XLM credited to active persona!");
        await refreshBalance();
      } else {
        setFaucetMsg(data.message || "Friendbot request failed");
      }
    } catch {
      setFaucetMsg("Friendbot network error");
    } finally {
      setFaucetLoading(false);
    }
  };

  const handleReset = async () => {
    if (
      confirm(
        "Reset all shared treasuries, proposals, and logs back to the PRD Section 26 demo state?"
      )
    ) {
      setIsResetting(true);
      await onResetDemo();
      setIsResetting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
      {/* Title */}
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
          Wallet & Governance Settings
        </h1>
        <p className="text-xs text-slate-400">
          Stellar Testnet connection, active signer identity, and environment controls
        </p>
      </div>

      {/* Connected Signer Identity Card */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6 space-y-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 border border-slate-700 text-3xl">
              {activePersona.avatar}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  {activePersona.name}
                </h2>
                <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                  {activePersona.role}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Connected Signer Identity
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            <Radio className="h-3 w-3 animate-pulse" />
            <span>Stellar Testnet</span>
          </div>
        </div>

        {/* Address & balance info */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-slate-400">Public Stellar Address:</span>
              <div className="font-mono text-cyan-300 text-[11px] sm:text-xs break-all mt-0.5">
                {activePersona.address}
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={copy}
                className="flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs text-slate-200 transition"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
              <a
                href={getStellarExpertUrl("account", activePersona.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs text-cyan-400 transition"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Explorer</span>
              </a>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-slate-400">
              Testnet Native Balance:{" "}
              <strong className="text-white font-mono">
                {testnetBalance !== null ? `${parseFloat(testnetBalance).toLocaleString()} XLM` : "Loading..."}
              </strong>
            </div>

            <button
              onClick={handleFaucet}
              disabled={faucetLoading}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-600/20 border border-cyan-500/30 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-600/30 transition"
            >
              <Zap className={`h-3.5 w-3.5 ${faucetLoading ? "animate-spin" : ""}`} />
              <span>{faucetLoading ? "Requesting..." : "Get Testnet XLM (Friendbot)"}</span>
            </button>
          </div>
        </div>

        {faucetMsg && (
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3 text-xs text-cyan-200">
            {faucetMsg}
          </div>
        )}
      </div>

      {/* Switch Signer Persona Grid */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-white">
            Multi-Party Signer Personas
          </h2>
          <p className="text-xs text-slate-400">
            Easily simulate multiple officer approvals from the same device without opening multiple browsers
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {personas.map((p) => {
            const isSelected = p.id === activePersona.id;
            return (
              <button
                key={p.id}
                onClick={() => setActivePersona(p)}
                className={`rounded-2xl border p-4 text-left transition flex items-start justify-between gap-2 ${
                  isSelected
                    ? "border-emerald-500/60 bg-emerald-950/20 ring-1 ring-emerald-500"
                    : "border-slate-800 bg-slate-950/80 hover:border-slate-700 hover:bg-slate-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{p.avatar}</span>
                  <div>
                    <div className="text-xs font-bold text-white">{p.name}</div>
                    <div className="text-[11px] text-slate-400">{p.role}</div>
                    <div className="text-[10px] font-mono text-slate-500 mt-1">
                      {formatAddress(p.address, 4)}
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Freighter Extension Connection Card */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Freighter Wallet Extension
              </h2>
              <p className="text-xs text-slate-400">
                Connect your browser-installed Freighter Stellar wallet for hardware/extension signing
              </p>
            </div>
          </div>

          <div>
            {isFreighterConnected ? (
              <button
                onClick={disconnectFreighter}
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition"
              >
                Disconnect Freighter
              </button>
            ) : (
              <button
                onClick={connectFreighter}
                className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-500 transition shadow-md shadow-cyan-600/30"
              >
                Connect Freighter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Reset State Card */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white">Reset Demo Database</h2>
            <p className="text-xs text-slate-400">
              Restore initial PRD Section 26 demo data (IT Society Event Fund, Venue Deposit 4,500 units, 2/3 approvals)
            </p>
          </div>

          <button
            onClick={handleReset}
            disabled={isResetting}
            className="flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-750 px-4 py-2.5 text-xs font-semibold text-slate-200 border border-slate-700 transition self-start sm:self-auto"
          >
            <RotateCcw className={`h-4 w-4 ${isResetting ? "animate-spin text-emerald-400" : ""}`} />
            <span>{isResetting ? "Resetting..." : "Reset to Default State"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
