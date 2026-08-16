"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Treasury, Proposal } from "@/types";
import { WalletProvider, useWallet } from "@/context/WalletContext";
import { Navigation, NavView } from "@/components/Navigation";
import { OverviewView } from "@/components/OverviewView";
import { TreasuryList } from "@/components/TreasuryList";
import { TreasuryDetail } from "@/components/TreasuryDetail";
import { GlobalProposalsView } from "@/components/GlobalProposalsView";
import { GlobalActivityView } from "@/components/GlobalActivityView";
import { WalletSettingsView } from "@/components/WalletSettingsView";
import { CreateTreasuryModal } from "@/components/CreateTreasuryModal";
import { ContractModal } from "@/components/ContractModal";
import { DemoTourModal } from "@/components/DemoTourModal";
import { OverviewSkeleton } from "@/components/Skeletons";
import { EnvironmentBadge } from "@/components/EnvironmentBadge";
import { WalletSetupState } from "@/components/WalletSetupState";
import { coholdConfig, isStateChangingAllowed } from "@/lib/cohold-config";
import {
  LayoutDashboard,
  Coins,
  FileSpreadsheet,
  History,
  Settings,
  ShieldCheck,
  PlusCircle,
  PlayCircle,
  Code2,
  RefreshCw,
} from "lucide-react";

function MainApp() {
  const canMutate = isStateChangingAllowed(coholdConfig);
  const [currentView, setCurrentView] = useState<NavView>("overview");
  const [treasuries, setTreasuries] = useState<Treasury[]>([]);
  const [allProposals, setAllProposals] = useState<
    (Proposal & { treasury?: Partial<Treasury> })[]
  >([]);
  const [selectedTreasuryId, setSelectedTreasuryId] = useState<string | null>(null);
  const [selectedTreasury, setSelectedTreasury] = useState<Treasury | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isDemoTourOpen, setIsDemoTourOpen] = useState(false);

  // 1. Fetch Treasuries & Consolidated Proposals
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [tRes, pRes] = await Promise.all([
        fetch("/api/treasuries"),
        fetch("/api/proposals"),
      ]);
      const tData = await tRes.json();
      const pData = await pRes.json();

      if (tData.success) {
        setTreasuries(tData.treasuries || []);
      }
      if (pData.success) {
        setAllProposals(pData.proposals || []);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load data";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Fetch Selected Treasury Detail
  const fetchTreasuryDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/treasuries/${id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedTreasury(data.treasury);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!canMutate) return;
    const timer = window.setTimeout(() => {
      void fetchData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canMutate, fetchData]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (selectedTreasuryId) {
        void fetchTreasuryDetail(selectedTreasuryId);
      } else {
        setSelectedTreasury(null);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedTreasuryId, fetchTreasuryDetail]);

  const handleSelectTreasury = (id: string | null) => {
    setSelectedTreasuryId(id);
    if (id) {
      setCurrentView("treasuries");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleNavigate = (view: NavView) => {
    setCurrentView(view);
    if (view !== "treasuries") {
      setSelectedTreasuryId(null);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleTreasuryCreated = (newId: string) => {
    fetchData();
    handleSelectTreasury(newId);
  };

  const handleResetDemo = async () => {
    try {
      const res = await fetch("/api/stellar/reset-demo", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        await fetchData();
        if (selectedTreasuryId) {
          await fetchTreasuryDetail(selectedTreasuryId);
        }
      }
    } catch {
      // ignore
    }
  };

  const pendingProposalsCount = allProposals.filter(
    (p) => p.status === "pending"
  ).length;

  const sidebarLinks = [
    {
      id: "overview" as NavView,
      label: "Overview",
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      id: "treasuries" as NavView,
      label: "Treasuries",
      icon: <Coins className="h-4 w-4" />,
      count: treasuries.length,
    },
    {
      id: "proposals" as NavView,
      label: "Proposals",
      icon: <FileSpreadsheet className="h-4 w-4" />,
      badge: pendingProposalsCount > 0 ? pendingProposalsCount : null,
    },
    {
      id: "activity" as NavView,
      label: "Activity",
      icon: <History className="h-4 w-4" />,
    },
    {
      id: "wallet_settings" as NavView,
      label: "Wallet & Settings",
      icon: <Settings className="h-4 w-4" />,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Header Navigation */}
      <Navigation
        currentView={currentView}
        onNavigate={handleNavigate}
        onCreateTreasury={() => setIsCreateModalOpen(true)}
        onOpenDemoTour={() => setIsDemoTourOpen(true)}
        onOpenContractModal={() => setIsContractModalOpen(true)}
        pendingProposalsCount={pendingProposalsCount}
        canMutate={canMutate}
      />

      {/* Main Content Layout with Desktop Persistent Sidebar */}
      <div className="mx-auto w-full max-w-7xl flex-1 flex flex-col md:flex-row px-4 sm:px-6 py-6 gap-6">
        {/* Desktop Left Sidebar (§7.1 Persistent Left Sidebar) */}
        <aside className="hidden md:flex flex-col w-56 shrink-0 space-y-6">
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
              Menu
            </div>
            {sidebarLinks.map((item) => {
              const isActive =
                currentView === item.id &&
                (!selectedTreasuryId || item.id === "treasuries");

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                    isActive
                      ? "bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>

                  {Boolean(item.badge) && (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Actions in Sidebar */}
          <div className="pt-4 border-t border-slate-800/80 space-y-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1">
              Actions
            </div>

            {canMutate && <button
              onClick={() => setIsCreateModalOpen(true)}
              className="w-full flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20 transition"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create Treasury</span>
            </button>}

            {canMutate && <button
              onClick={() => setIsDemoTourOpen(true)}
              className="w-full flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-amber-500/30 px-3 py-2 text-xs font-semibold text-amber-300 transition"
            >
              <PlayCircle className="h-4 w-4 text-amber-400" />
              <span>Run PRD §26 Demo</span>
            </button>}

            <button
              onClick={() => setIsContractModalOpen(true)}
              className="w-full flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 px-3 py-2 text-xs font-medium text-slate-300 transition"
            >
              <Code2 className="h-4 w-4 text-cyan-400" />
              <span>Soroban Contract</span>
            </button>
          </div>

          {/* Network context badge */}
          <div className="mt-auto pt-6 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1 px-3">
            <EnvironmentBadge />
            <div className="text-slate-400">Soroban SDK v21+</div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          {!canMutate ? (
            <WalletSetupState />
          ) : loading && treasuries.length === 0 ? (
            <OverviewSkeleton />
          ) : error && treasuries.length === 0 ? (
            <div className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-8 text-center space-y-3">
              <h3 className="text-base font-bold text-rose-300">
                Failed to load shared treasuries
              </h3>
              <p className="text-xs text-slate-400">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  fetchData();
                }}
                className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
              >
                Retry
              </button>
            </div>
          ) : selectedTreasuryId && selectedTreasury ? (
            <TreasuryDetail
              treasury={selectedTreasury}
              onBack={() => handleSelectTreasury(null)}
              onRefresh={() => {
                fetchData();
                fetchTreasuryDetail(selectedTreasuryId);
              }}
            />
          ) : currentView === "overview" ? (
            <OverviewView
              treasuries={treasuries}
              proposals={allProposals}
              onSelectTreasury={handleSelectTreasury}
              onCreateTreasury={() => setIsCreateModalOpen(true)}
              onOpenDemoTour={() => setIsDemoTourOpen(true)}
              onNavigateToProposals={() => setCurrentView("proposals")}
              onNavigateToTreasuries={() => setCurrentView("treasuries")}
            />
          ) : currentView === "treasuries" ? (
            <TreasuryList
              treasuries={treasuries}
              onSelectTreasury={handleSelectTreasury}
              onCreateTreasury={() => setIsCreateModalOpen(true)}
              onOpenDemoTour={() => setIsDemoTourOpen(true)}
            />
          ) : currentView === "proposals" ? (
            <GlobalProposalsView
              proposals={allProposals}
              treasuries={treasuries}
              onSelectTreasury={handleSelectTreasury}
              onRefresh={fetchData}
            />
          ) : currentView === "activity" ? (
            <GlobalActivityView />
          ) : currentView === "wallet_settings" ? (
            <WalletSettingsView onResetDemo={handleResetDemo} />
          ) : null}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-8 px-4 sm:px-6 mt-12 text-xs text-slate-400 hidden sm:block">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs">
              C
            </div>
            <span className="font-bold text-white">Cohold</span>
            <span className="text-slate-500">·</span>
            <span>Shared funds. Shared control.</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <EnvironmentBadge />
            <span>·</span>
            <span>Zero Unilateral Custody</span>
            <span>·</span>
            <button
              onClick={() => setIsContractModalOpen(true)}
              className="text-cyan-400 hover:underline"
            >
              Contract Rust Source
            </button>
          </div>
        </div>
      </footer>

      {/* Global Modals */}
      {canMutate && <CreateTreasuryModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleTreasuryCreated}
      />}

      <ContractModal
        isOpen={isContractModalOpen}
        onClose={() => setIsContractModalOpen(false)}
      />

      {canMutate && <DemoTourModal
        isOpen={isDemoTourOpen}
        onClose={() => setIsDemoTourOpen(false)}
        onRefreshData={() => {
          fetchData();
          if (selectedTreasuryId) {
            fetchTreasuryDetail(selectedTreasuryId);
          }
        }}
      />}
    </div>
  );
}

export default function Page() {
  return (
    <WalletProvider>
      <MainApp />
    </WalletProvider>
  );
}
