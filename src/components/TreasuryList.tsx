"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Treasury, TreasuryCategory } from "@/types";
import { APP_ROUTES } from "@/lib/app-routes";
import { formatAmount } from "@/lib/utils";
import {
  ShieldCheck,
  Coins,
  Users,
  FileSpreadsheet,
  PlusCircle,
  PlayCircle,
  Sparkles,
  ArrowRight,
  GraduationCap,
  Briefcase,
  Trees,
  Rocket,
  Search,
  Filter,
} from "lucide-react";

interface TreasuryListProps {
  treasuries: Treasury[];
  onCreateTreasury: () => void;
  onOpenDemoTour: () => void;
}

export function TreasuryList({
  treasuries,
  onCreateTreasury,
  onOpenDemoTour,
}: TreasuryListProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = treasuries.filter((t) => {
    if (selectedCategory !== "all" && t.category !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "student_org":
        return <GraduationCap className="h-4 w-4 text-emerald-400" />;
      case "small_business":
        return <Briefcase className="h-4 w-4 text-blue-400" />;
      case "community_fund":
        return <Trees className="h-4 w-4 text-amber-400" />;
      case "project_team":
        return <Rocket className="h-4 w-4 text-purple-400" />;
      default:
        return <ShieldCheck className="h-4 w-4 text-cyan-400" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "student_org":
        return "Student Organization";
      case "small_business":
        return "Small Business";
      case "community_fund":
        return "Community Fund";
      case "project_team":
        return "Project Team";
      default:
        return "Treasury";
    }
  };

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 p-6 sm:p-10 shadow-2xl">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Shared funds. Shared control.</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Multi-approval shared treasury on{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Stellar Soroban
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Replace individual bank account custody with cryptographic group governance. Treasury funds can leave
            only when your team reaches its agreed approval threshold.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-3">
            <button
              onClick={onCreateTreasury}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create New Treasury</span>
            </button>

            <button
              onClick={onOpenDemoTour}
              className="flex items-center gap-2 rounded-xl bg-slate-800/90 border border-slate-700 px-5 py-3 text-xs sm:text-sm font-semibold text-slate-200 hover:bg-slate-750 hover:text-white transition"
            >
              <PlayCircle className="h-4 w-4 text-amber-400" />
              <span>Run PRD Section 26 Demo</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8 mt-8 border-t border-slate-800/80">
          <div className="space-y-1">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Zero Unilateral Outflows</span>
            </div>
            <p className="text-[11px] text-slate-400">
              No single treasurer or president can withdraw group funds without quorum.
            </p>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <Users className="h-4 w-4 text-cyan-400" />
              <span>Immutable Governance</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Member list and approval rules are locked on-chain in Soroban smart contracts.
            </p>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <FileSpreadsheet className="h-4 w-4 text-purple-400" />
              <span>Transparent Proposals</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Review recipients, purpose, amounts, and live cryptographic approval status.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`rounded-xl px-3.5 py-2 font-semibold transition ${
              selectedCategory === "all"
                ? "bg-slate-800 text-white"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            All Treasuries ({treasuries.length})
          </button>
          <button
            onClick={() => setSelectedCategory("student_org")}
            className={`rounded-xl px-3.5 py-2 font-semibold transition ${
              selectedCategory === "student_org"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            Student Orgs
          </button>
          <button
            onClick={() => setSelectedCategory("small_business")}
            className={`rounded-xl px-3.5 py-2 font-semibold transition ${
              selectedCategory === "small_business"
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            Small Business
          </button>
          <button
            onClick={() => setSelectedCategory("community_fund")}
            className={`rounded-xl px-3.5 py-2 font-semibold transition ${
              selectedCategory === "community_fund"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            Community
          </button>
          <button
            onClick={() => setSelectedCategory("project_team")}
            className={`rounded-xl px-3.5 py-2 font-semibold transition ${
              selectedCategory === "project_team"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            Project Teams
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search treasuries..."
            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-9 py-2 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((t) => {
          const quorumPercent = Math.round((t.threshold / t.memberCount) * 100);

          return (
            <Link
              key={t.id}
              href={APP_ROUTES.treasury(t.id)}
              className="group rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg hover:border-emerald-500/50 hover:bg-slate-850/90 transition duration-200 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 rounded-md bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-300">
                    {getCategoryIcon(t.category)}
                    <span>{getCategoryLabel(t.category)}</span>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                    Soroban Active
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition">
                    {t.name}
                  </h3>
                  {t.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {t.description}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Contract Balance</div>
                    <div className="text-lg font-bold font-mono tabular-nums text-emerald-400">
                      {formatAmount(t.balance, t.tokenSymbol)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Quorum Rule</div>
                    <div className="text-sm font-bold font-mono tabular-nums text-slate-200">
                      {t.threshold} of {t.memberCount} ({quorumPercent}%)
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1 text-slate-300">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-cyan-400" />
                  <span>{(t as unknown as { proposalsCount?: number }).proposalsCount || 0} Proposals</span>
                </div>

                <div className="flex items-center gap-1 text-emerald-400 font-semibold group-hover:translate-x-1 transition transform">
                  <span>Enter Treasury</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </Link>
          );
        })}

        <div
          role="button"
          tabIndex={0}
          onClick={onCreateTreasury}
          onKeyDown={(e) => e.key === "Enter" && onCreateTreasury()}
          className="group cursor-pointer rounded-2xl border-2 border-dashed border-slate-800 bg-slate-950/40 p-6 flex flex-col items-center justify-center text-center space-y-3 hover:border-emerald-500/50 hover:bg-slate-900/40 transition min-h-[220px]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 group-hover:text-emerald-400 group-hover:border-emerald-500/40 transition">
            <PlusCircle className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white group-hover:text-emerald-400 transition">
              Create New Treasury
            </h4>
            <p className="text-xs text-slate-400 max-w-[200px] mt-0.5">
              Set up members and threshold rules on Stellar Testnet
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
