"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/context/WalletContext";
import { formatAddress } from "@/lib/utils";
import { APP_NAV, APP_ROUTES, navKeyFromPathname, type AppNavKey } from "@/lib/app-routes";
import { EnvironmentBadge } from "@/components/EnvironmentBadge";
import {
  ShieldCheck,
  LayoutDashboard,
  Coins,
  FileSpreadsheet,
  History,
  Settings,
  PlusCircle,
  PlayCircle,
  Code2,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";

interface NavigationProps {
  onCreateTreasury: () => void;
  onOpenDemoTour: () => void;
  onOpenContractModal: () => void;
  pendingProposalsCount: number;
  canMutate: boolean;
}

const navIcons: Record<AppNavKey, React.ReactNode> = {
  overview: <LayoutDashboard className="h-4 w-4" />,
  treasuries: <Coins className="h-4 w-4" />,
  proposals: <FileSpreadsheet className="h-4 w-4" />,
  activity: <History className="h-4 w-4" />,
  wallet: <Settings className="h-4 w-4" />,
};

const navItems = APP_NAV.map((item) => ({
  ...item,
  icon: navIcons[item.key],
}));

export function Navigation({
  onCreateTreasury,
  onOpenDemoTour,
  onOpenContractModal,
  pendingProposalsCount,
  canMutate,
}: NavigationProps) {
  const { activePersona, setActivePersona, personas } = useWallet();
  const pathname = usePathname();
  const currentView = navKeyFromPathname(pathname);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [personaMenuOpen, setPersonaMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={APP_ROUTES.overview}
              className="flex items-center gap-2.5 text-left group shrink-0"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 shadow-md shadow-emerald-500/20 group-hover:scale-105 transition transform">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <div className="max-[380px]:hidden">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold tracking-tight text-white group-hover:text-emerald-400 transition">
                    Cohold
                  </span>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20 hidden sm:inline">
                    Soroban
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium hidden md:block">
                  Shared funds. Shared control.
                </p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            <EnvironmentBadge compact />
            {canMutate && (
              <button
                type="button"
                onClick={onOpenDemoTour}
                className="hidden lg:flex items-center gap-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 transition"
              >
                <PlayCircle className="h-3.5 w-3.5 text-amber-400" />
                <span>Demo Walkthrough</span>
                <span className="rounded bg-amber-500/30 px-1 py-0.2 text-[9px] uppercase font-bold text-amber-200">
                  PRD §26
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenContractModal}
              className="hidden md:flex items-center gap-1.5 rounded-xl bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 transition"
            >
              <Code2 className="h-3.5 w-3.5 text-cyan-400" />
              <span>Smart Contract</span>
            </button>

            {canMutate && (
              <button
                type="button"
                onClick={onCreateTreasury}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-600 transition shadow-md shadow-emerald-700/30"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New Treasury</span>
                <span className="sm:hidden">New</span>
              </button>
            )}

            {canMutate && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPersonaMenuOpen(!personaMenuOpen)}
                  className="flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-700 transition"
                >
                  <span className="text-base">{activePersona.avatar}</span>
                  <div className="text-left hidden sm:block">
                    <div className="font-semibold text-white leading-tight">
                      {activePersona.name.split(" ")[0]}
                    </div>
                    <div className="text-[10px] text-emerald-400 font-mono tabular-nums">
                      {activePersona.role}
                    </div>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </button>

                {personaMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-72 rounded-2xl bg-slate-900 border border-slate-700 p-2 shadow-2xl z-50 animate-in fade-in"
                    onClick={() => setPersonaMenuOpen(false)}
                  >
                    <div className="px-3 py-2 border-b border-slate-800 mb-1">
                      <div className="text-xs font-bold text-white">
                        Select Signer Persona
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Switch identities to test multi-signature approvals
                      </p>
                    </div>

                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {personas.map((p) => {
                        const isSelected = p.id === activePersona.id;
                        return (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => setActivePersona(p)}
                            className={`w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition ${
                              isSelected
                                ? "bg-emerald-500/20 text-white font-bold border border-emerald-500/30"
                                : "hover:bg-slate-800 text-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{p.avatar}</span>
                              <div>
                                <div className="font-medium text-white">
                                  {p.name}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {p.role} · {formatAddress(p.address, 3)}
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <span className="h-2 w-2 rounded-full bg-emerald-400" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex md:hidden items-center justify-center h-9 w-9 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-slate-950 p-4 space-y-3 animate-in slide-in-from-top-2">
            <div className="grid grid-cols-2 gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-semibold transition ${
                    currentView === item.key
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2">
              {canMutate && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenDemoTour();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl bg-amber-500/15 border border-amber-500/30 p-2.5 text-xs font-bold text-amber-300"
                >
                  <PlayCircle className="h-4 w-4 text-amber-400" />
                  <span>Run PRD Section 26 Demo Walkthrough</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onOpenContractModal();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-xs font-medium text-slate-300"
              >
                <Code2 className="h-4 w-4 text-cyan-400" />
                <span>Inspect Soroban Contract Source</span>
              </button>
            </div>
          </div>
        )}
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-slate-800 bg-slate-950/95 backdrop-blur-lg px-2 py-2 safe-area-pb">
        <div className="grid grid-cols-5 gap-1">
          {navItems.map((item) => {
            const isActive = currentView === item.key;
            const badge =
              item.key === "proposals" && pendingProposalsCount > 0
                ? pendingProposalsCount
                : null;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`relative flex flex-col items-center justify-center py-1 rounded-xl text-[10px] font-medium transition ${
                  isActive
                    ? "text-emerald-400 font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <div className="relative">
                  {item.icon}
                  {badge ? (
                    <span className="absolute -top-1 -right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-slate-950">
                      {badge}
                    </span>
                  ) : null}
                </div>
                <span className="mt-1 truncate max-w-[56px]">
                  {item.label.split(" ")[0]}
                </span>
                {isActive && (
                  <span className="absolute -bottom-1 h-1 w-6 rounded-full bg-emerald-400" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
