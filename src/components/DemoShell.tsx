"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { CreateTreasuryModal } from "@/components/CreateTreasuryModal";
import { ContractModal } from "@/components/ContractModal";
import { DemoTourModal } from "@/components/DemoTourModal";
import { EnvironmentBadge } from "@/components/EnvironmentBadge";
import { useDemoData } from "@/context/DemoDataContext";
import { APP_NAV, APP_ROUTES, navKeyFromPathname, type AppNavKey } from "@/lib/app-routes";
import {
  LayoutDashboard,
  Coins,
  FileSpreadsheet,
  History,
  Settings,
  PlusCircle,
  PlayCircle,
  Code2,
} from "lucide-react";

const navIcons: Record<AppNavKey, React.ReactNode> = {
  overview: <LayoutDashboard className="h-4 w-4" />,
  treasuries: <Coins className="h-4 w-4" />,
  proposals: <FileSpreadsheet className="h-4 w-4" />,
  activity: <History className="h-4 w-4" />,
  wallet: <Settings className="h-4 w-4" />,
};

const sidebarLinks = APP_NAV.map((item) => ({
  ...item,
  icon: navIcons[item.key],
}));

export function DemoShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const currentView = navKeyFromPathname(pathname);
  const {
    treasuries,
    proposals,
    refresh,
    canMutate,
    openCreateTreasury,
    openDemoTour,
    openContractModal,
    setCreateTreasuryOpen,
    setDemoTourOpen,
    setContractModalOpen,
    isCreateTreasuryOpen,
    isDemoTourOpen,
    isContractModalOpen,
  } = useDemoData();

  const pendingProposalsCount = proposals.filter((p) => p.status === "pending").length;

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      <Navigation
        onCreateTreasury={openCreateTreasury}
        onOpenDemoTour={openDemoTour}
        onOpenContractModal={openContractModal}
        pendingProposalsCount={pendingProposalsCount}
        canMutate={canMutate}
      />

      <div className="mx-auto w-full max-w-7xl flex-1 flex flex-col md:flex-row px-4 sm:px-6 py-6 gap-6">
        <aside className="hidden md:flex flex-col w-56 shrink-0 space-y-6">
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
              Menu
            </div>
            {sidebarLinks.map((item) => {
              const isActive = currentView === item.key;
              const badge =
                item.key === "proposals" && pendingProposalsCount > 0
                  ? pendingProposalsCount
                  : item.key === "treasuries"
                    ? treasuries.length
                    : null;

              return (
                <Link
                  key={item.key}
                  href={item.href}
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
                  {badge ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                        item.key === "proposals"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                          : "bg-slate-800 text-slate-300 border-slate-700"
                      }`}
                    >
                      {badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-800/80 space-y-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1">
              Actions
            </div>

            {canMutate && (
              <button
                type="button"
                onClick={openCreateTreasury}
                className="w-full flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20 transition"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Create Treasury</span>
              </button>
            )}

            {canMutate && (
              <button
                type="button"
                onClick={openDemoTour}
                className="w-full flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-amber-500/30 px-3 py-2 text-xs font-semibold text-amber-300 transition"
              >
                <PlayCircle className="h-4 w-4 text-amber-400" />
                <span>Run PRD §26 Demo</span>
              </button>
            )}

            <button
              type="button"
              onClick={openContractModal}
              className="w-full flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 px-3 py-2 text-xs font-medium text-slate-300 transition"
            >
              <Code2 className="h-4 w-4 text-cyan-400" />
              <span>Soroban Contract</span>
            </button>
          </div>

          <div className="mt-auto pt-6 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1 px-3">
            <EnvironmentBadge />
            <div className="text-slate-400">Soroban SDK v21+</div>
          </div>
        </aside>

        <main className="flex-1 min-w-0">{children}</main>
      </div>

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
              type="button"
              onClick={openContractModal}
              className="text-cyan-400 hover:underline"
            >
              Contract Rust Source
            </button>
          </div>
        </div>
      </footer>

      {canMutate && (
        <CreateTreasuryModal
          isOpen={isCreateTreasuryOpen}
          onClose={() => setCreateTreasuryOpen(false)}
          onSuccess={(newId) => {
            void refresh();
            router.push(APP_ROUTES.treasury(newId));
          }}
        />
      )}

      <ContractModal
        isOpen={isContractModalOpen}
        onClose={() => setContractModalOpen(false)}
      />

      {canMutate && (
        <DemoTourModal
          isOpen={isDemoTourOpen}
          onClose={() => setDemoTourOpen(false)}
          onRefreshData={() => {
            void refresh();
          }}
        />
      )}
    </div>
  );
}
