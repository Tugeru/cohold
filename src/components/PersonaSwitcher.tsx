"use client";

import React, { useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { formatAddress } from "@/lib/utils";
import { TreasuryMember } from "@/types";
import {
  Shield,
  Coins,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Zap,
  UserCheck,
} from "lucide-react";

interface PersonaSwitcherProps {
  currentMembers?: TreasuryMember[];
  tokenSymbol?: string;
}

export function PersonaSwitcher({
  currentMembers = [],
  tokenSymbol = "DEMO_UNITS",
}: PersonaSwitcherProps) {
  const {
    activePersona,
    setActivePersona,
    personas,
    testnetBalance,
    refreshBalance,
  } = useWallet();
  const [copied, setCopied] = useState(false);
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetMsg, setFaucetMsg] = useState<string | null>(null);

  // Check if active persona is a member of the currently viewed treasury
  const isMember = currentMembers.some(
    (m) => m.address.toUpperCase() === activePersona.address.toUpperCase()
  );
  const memberRecord = currentMembers.find(
    (m) => m.address.toUpperCase() === activePersona.address.toUpperCase()
  );

  const copyAddress = () => {
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
        setFaucetMsg("10,000 Testnet XLM Received!");
        await refreshBalance();
      } else {
        setFaucetMsg(data.message || "Faucet unavailable");
      }
    } catch {
      setFaucetMsg("Faucet request failed");
    } finally {
      setFaucetLoading(false);
      setTimeout(() => setFaucetMsg(null), 4000);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 sm:p-4 backdrop-blur shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left: Current Active Identity */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-2xl shadow-inner">
            {activePersona.avatar}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-white text-sm sm:text-base">
                {activePersona.name}
              </span>
              <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300 border border-slate-700">
                {activePersona.role}
              </span>

              {/* Membership Status Badge for this treasury */}
              {currentMembers.length > 0 && (
                <>
                  {isMember ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="h-3 w-3" />
                      Authorized Signer
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400 border border-amber-500/20">
                      <AlertCircle className="h-3 w-3" />
                      Non-Member Viewer
                    </span>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
              <span className="font-mono text-slate-300">
                {formatAddress(activePersona.address, 6)}
              </span>
              <button
                onClick={copyAddress}
                className="text-slate-400 hover:text-slate-200 transition"
                title="Copy address"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>

              {testnetBalance !== null && (
                <span className="text-slate-400 hidden sm:inline">
                  · Testnet Balance:{" "}
                  <span className="font-semibold text-slate-200 font-mono">
                    {parseFloat(testnetBalance).toLocaleString()} XLM
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Quick Persona Switcher Chips & Faucet */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <div className="text-xs text-slate-400 font-medium mr-1 hidden sm:block">
            Quick Switch Signer:
          </div>
          {personas.slice(0, 4).map((p) => {
            const isSelected = p.id === activePersona.id;
            return (
              <button
                key={p.id}
                onClick={() => setActivePersona(p)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  isSelected
                    ? "bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white border border-slate-700"
                }`}
              >
                <span>{p.avatar}</span>
                <span>{p.name.split(" ")[0]}</span>
                <span className="text-[10px] opacity-75 font-normal">
                  ({p.role.slice(0, 4)})
                </span>
              </button>
            );
          })}

          {/* Stellar Friendbot Faucet */}
          <button
            onClick={handleFaucet}
            disabled={faucetLoading}
            className="flex items-center gap-1 rounded-lg bg-cyan-950/60 border border-cyan-500/30 px-2.5 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-900/50 transition"
            title="Request Testnet XLM from Stellar Friendbot"
          >
            <Zap className={`h-3.5 w-3.5 ${faucetLoading ? "animate-spin text-cyan-400" : "text-cyan-400"}`} />
            <span className="hidden sm:inline">Friendbot</span>
          </button>
        </div>
      </div>

      {faucetMsg && (
        <div className="mt-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 text-xs font-medium text-cyan-300 animate-in fade-in">
          {faucetMsg}
        </div>
      )}
    </div>
  );
}
