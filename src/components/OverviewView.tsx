"use client";

import React from "react";
import { Treasury, Proposal } from "@/types";
import { useWallet } from "@/context/WalletContext";
import { formatAmount, formatAddress, timeAgo } from "@/lib/utils";
import { parseNonNegativeBaseUnits } from "@/lib/money";
import {
  Coins,
  ShieldCheck,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ArrowRight,
  PlusCircle,
  PlayCircle,
  Send,
  Zap,
  Sparkles,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  Receipt,
  UserCheck,
} from "lucide-react";

interface OverviewViewProps {
  treasuries: Treasury[];
  proposals: Proposal[];
  onSelectTreasury: (id: string) => void;
  onCreateTreasury: () => void;
  onOpenDemoTour: () => void;
  onNavigateToProposals: () => void;
  onNavigateToTreasuries: () => void;
}

export function OverviewView({
  treasuries,
  proposals,
  onSelectTreasury,
  onCreateTreasury,
  onOpenDemoTour,
  onNavigateToProposals,
  onNavigateToTreasuries,
}: OverviewViewProps) {
  const { activePersona } = useWallet();

  // Calculate totals
  const totalBalance = treasuries.reduce((acc, treasury) => {
    try {
      return acc + parseNonNegativeBaseUnits(treasury.balance);
    } catch {
      return acc;
    }
  }, 0n);
  const activeTreasuriesCount = treasuries.length;

  // Proposals that need active persona's approval
  const needsMyApproval = proposals.filter((p) => {
    if (p.status !== "pending") return false;
    const approvals = p.approvals || [];
    const hasApproved = approvals.some(
      (a) => a.approverAddress.toUpperCase() === activePersona.address.toUpperCase()
    );
    return !hasApproved;
  });

  // Ready to execute proposals
  const readyToExecute = proposals.filter((p) => p.status === "approved");

  // Recently executed proposals
  const recentlyExecuted = proposals
    .filter((p) => p.status === "executed")
    .slice(0, 5);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 p-5 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20">
              <Sparkles className="h-3 w-3" />
              <span>Active Signer: {activePersona.name} ({activePersona.role})</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Shared Treasury Overview
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Manage shared funds with cryptographic multi-signature quorum rules on Stellar Soroban.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={onCreateTreasury}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/30 transition"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create Treasury</span>
            </button>
            <button
              onClick={onOpenDemoTour}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-750 transition"
            >
              <PlayCircle className="h-4 w-4 text-amber-400" />
              <span>Interactive Demo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Treasury Balance */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Treasury Funds</span>
            <Coins className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight">
            {formatAmount(totalBalance, "DEMO_UNITS")}
          </div>
          <div className="text-[11px] text-emerald-400 font-medium">
            DEMO_UNITS on Stellar Testnet
          </div>
        </div>

        {/* Card 2: Active Treasuries */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Active Treasuries</span>
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight">
            {activeTreasuriesCount}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Governed by Soroban Contracts
          </div>
        </div>

        {/* Card 3: Needs My Approval */}
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/10 p-5 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-amber-300">
            <span>Needs My Approval</span>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-amber-300 tracking-tight">
            {needsMyApproval.length}
          </div>
          <div className="text-[11px] text-amber-400/80 font-medium">
            Awaiting your signature
          </div>
        </div>

        {/* Card 4: Ready to Execute */}
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/10 p-5 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-emerald-300">
            <span>Ready to Disburse</span>
            <Zap className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-300 tracking-tight">
            {readyToExecute.length}
          </div>
          <div className="text-[11px] text-emerald-400/80 font-medium">
            Quorum threshold achieved
          </div>
        </div>
      </div>

      {/* Actionable Sections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Needs My Approval & Actionable Proposals */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section: Needs My Approval */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm sm:text-base font-bold text-white">
                  Needs My Approval ({needsMyApproval.length})
                </h2>
              </div>
              <button
                onClick={onNavigateToProposals}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                <span>View all proposals</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {needsMyApproval.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-center text-xs text-slate-400 space-y-1">
                <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto" />
                <div className="font-semibold text-slate-200">You&apos;re all caught up!</div>
                <div>No proposals currently need your signature.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {needsMyApproval.slice(0, 3).map((p) => {
                  const matchingTreasury = treasuries.find((t) => t.id === p.treasuryId);
                  return (
                    <div
                      key={p.id}
                      onClick={() => onSelectTreasury(p.treasuryId)}
                      className="group cursor-pointer rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 hover:border-amber-500/50 transition space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                        <div>
                          <span className="text-[11px] font-semibold text-emerald-400">
                            {matchingTreasury?.name || "Shared Treasury"}
                          </span>
                          <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition mt-0.5">
                            {p.title}
                          </h3>
                        </div>
                        <div className="text-left sm:text-right">
                          <div className="text-base font-bold font-mono text-emerald-400">
                            {formatAmount(p.amount, matchingTreasury?.tokenSymbol || "DEMO")}
                          </div>
                          <div className="text-[11px] text-amber-400 font-medium">
                            {p.approvalCount} of {p.threshold} Approvals
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Recipient: {p.recipientLabel || formatAddress(p.recipientAddress)}</span>
                        <span className="text-emerald-400 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition transform">
                          <span>Review & Sign</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Active Treasuries Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm sm:text-base font-bold text-white">
                  Active Shared Treasuries ({treasuries.length})
                </h2>
              </div>
              <button
                onClick={onNavigateToTreasuries}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                <span>View all treasuries</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {treasuries.slice(0, 4).map((t) => (
                <div
                  key={t.id}
                  onClick={() => onSelectTreasury(t.id)}
                  className="group cursor-pointer rounded-2xl border border-slate-800 bg-slate-900/80 p-4 hover:border-emerald-500/50 transition space-y-2 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-300">
                        {t.threshold} of {t.memberCount} Rule
                      </span>
                      <span className="font-mono text-emerald-400 font-bold">
                        {formatAmount(t.balance, t.tokenSymbol)}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition mt-1">
                      {t.name}
                    </h3>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <span>{t.memberCount} Authorized Members</span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-emerald-400 transition transform group-hover:translate-x-1" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Recently Executed Payments & Governance Quick Facts */}
        <div className="space-y-6">
          {/* Recently Disbursed Payments */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Recently Executed
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">
                {recentlyExecuted.length} Completed
              </span>
            </div>

            {recentlyExecuted.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No payments executed yet.
              </p>
            ) : (
              <div className="space-y-3">
                {recentlyExecuted.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-slate-800/80 bg-slate-950 p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white truncate max-w-[140px]">
                        {p.title}
                      </span>
                      <span className="font-mono font-bold text-emerald-400">
                        {formatAmount(p.amount, "DEMO")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>To: {p.recipientLabel || formatAddress(p.recipientAddress)}</span>
                      <span>{timeAgo(p.executedAt || p.updatedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Core Trust Model Card */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-5 space-y-3 text-xs">
            <div className="flex items-center gap-2 font-bold text-emerald-300">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Core Cohold Thesis</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              &ldquo;Shared money should require shared permission.&rdquo; Funds can
              leave a treasury only when a cryptographic quorum of members
              explicitly signs the proposal.
            </p>
            <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between text-[11px] text-slate-400">
              <span>Smart Contract Custody</span>
              <span className="text-emerald-400 font-semibold">100% On-Chain Rules</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
