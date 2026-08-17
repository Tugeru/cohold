"use client";

import React, { useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { formatAddress } from "@/lib/utils";
import {
  ShieldCheck,
  Zap,
  Code2,
  PlusCircle,
  PlayCircle,
  RotateCcw,
  ExternalLink,
  ChevronDown,
  Sparkles,
  Wallet,
} from "lucide-react";

interface HeaderProps {
  onCreateTreasury: () => void;
  onOpenContractModal: () => void;
  onOpenDemoTour: () => void;
  onResetDemo: () => void;
  onSelectTreasury: (id: string | null) => void;
  selectedTreasuryId: string | null;
}

export function Header({
  onCreateTreasury,
  onOpenContractModal,
  onOpenDemoTour,
  onResetDemo,
  onSelectTreasury,
  selectedTreasuryId,
}: HeaderProps) {
  const {
    activePersona,
    setActivePersona,
    personas,
    connectFreighter,
    isFreighterConnected,
  } = useWallet();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    if (confirm("Reset all treasuries and proposals back to initial demo state?")) {
      setIsResetting(true);
      await onResetDemo();
      setIsResetting(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand & Tagline */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectTreasury(null)}
            className="group flex items-center gap-2.5 text-left transition"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 shadow-md shadow-emerald-500/20 group-hover:scale-105 transition transform">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-white group-hover:text-emerald-400 transition">
                  Cohold
                </span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                  Soroban MVP
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium hidden sm:block">
                Shared funds. Shared control.
              </p>
            </div>
          </button>
        </div>

        {/* Action Controls & Wallet */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Section 26 Demo CTA */}
          <button
            onClick={onOpenDemoTour}
            className="hidden md:flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition shadow-sm"
          >
            <PlayCircle className="h-4 w-4 text-amber-400" />
            <span>Interactive Demo</span>
            <span className="rounded bg-amber-500/30 px-1 py-0.2 text-[9px] uppercase font-bold text-amber-200">
              PRD §26
            </span>
          </button>

          {/* Rust Contract Inspector */}
          <button
            onClick={onOpenContractModal}
            className="hidden lg:flex items-center gap-1.5 rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-600 transition"
          >
            <Code2 className="h-4 w-4 text-cyan-400" />
            <span>Soroban Contract</span>
          </button>

          {/* Reset Demo State Button */}
          <button
            onClick={handleReset}
            disabled={isResetting}
            title="Reset database to initial demo state"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition"
          >
            <RotateCcw
              className={`h-4 w-4 ${isResetting ? "animate-spin text-emerald-400" : ""}`}
            />
          </button>

          {/* Create Treasury CTA */}
          <button
            onClick={onCreateTreasury}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-emerald-600/30 hover:bg-emerald-500 transition"
          >
            <PlusCircle className="h-4 w-4" />
            <span className="hidden sm:inline">New Treasury</span>
            <span className="sm:hidden">New</span>
          </button>

          {/* Active Persona / Wallet Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 rounded-lg bg-slate-900 border border-slate-700/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-600 transition"
            >
              <span className="text-base leading-none">{activePersona.avatar}</span>
              <div className="text-left hidden sm:block">
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-white truncate max-w-[100px]">
                    {activePersona.name.split(" ")[0]}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono tabular-nums">
                    ({activePersona.role})
                  </span>
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {dropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-72 rounded-xl bg-slate-900 border border-slate-700 p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2"
                onClick={() => setDropdownOpen(false)}
              >
                <div className="px-2 py-1.5 border-b border-slate-800 mb-1">
                  <div className="text-xs font-semibold text-slate-400">
                    Switch Signer Persona
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Test multi-signature approvals across different roles without needing multiple browsers.
                  </p>
                </div>

                <div className="space-y-1">
                  {personas.map((p) => {
                    const isSelected = p.id === activePersona.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setActivePersona(p)}
                        className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition ${
                          isSelected
                            ? "bg-emerald-500/15 border border-emerald-500/30 text-white font-semibold"
                            : "hover:bg-slate-800 text-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{p.avatar}</span>
                          <div>
                            <div className="font-medium text-white">{p.name}</div>
                            <div className="text-[10px] text-slate-400">
                              {p.role} · {formatAddress(p.address, 3)}
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={connectFreighter}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-750 px-2.5 py-2 text-xs font-medium text-slate-200 hover:text-white transition"
                  >
                    <Wallet className="h-3.5 w-3.5 text-cyan-400" />
                    <span>{isFreighterConnected ? "Freighter Connected" : "Connect Freighter Extension"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
