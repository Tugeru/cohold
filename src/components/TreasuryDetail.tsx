"use client";

import React, { useState } from "react";
import { Treasury } from "@/types";
import { useWallet } from "@/context/WalletContext";
import { PersonaSwitcher } from "./PersonaSwitcher";
import { ProposalsTab } from "./ProposalsTab";
import { MembersTab } from "./MembersTab";
import { ContributionsTab } from "./ContributionsTab";
import { AuditTab } from "./AuditTab";
import { ContractInspectorTab } from "./ContractInspectorTab";
import { CreateProposalModal } from "./CreateProposalModal";
import { ContributeModal } from "./ContributeModal";
import { formatAddress, formatAmount, formatDate } from "@/lib/utils";
import { getStellarExpertUrl } from "@/lib/stellar";
import {
  ArrowLeft,
  Coins,
  Send,
  Users,
  ShieldCheck,
  FileSpreadsheet,
  History,
  Code2,
  ExternalLink,
  Lock,
  Layers,
  Sparkles,
  RefreshCw,
  Plus,
  Radio,
} from "lucide-react";

interface TreasuryDetailProps {
  treasury: Treasury;
  onBack: () => void;
  onRefresh: () => void;
}

export function TreasuryDetail({
  treasury,
  onBack,
  onRefresh,
}: TreasuryDetailProps) {
  const { activePersona } = useWallet();
  const [activeTab, setActiveTab] = useState<
    "proposals" | "members" | "deposits" | "audit" | "contract"
  >("proposals");
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [isContributeModalOpen, setIsContributeModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const proposals = treasury.proposals || [];
  const members = treasury.members || [];
  const pendingCount = proposals.filter(
    (p) => p.status === "pending" || p.status === "approved"
  ).length;

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setTimeout(() => setRefreshing(false), 500);
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case "student_org":
        return "Student Organization";
      case "small_business":
        return "Small Business / Partnership";
      case "community_fund":
        return "Community Fund";
      case "project_team":
        return "Project Team / Capstone";
      default:
        return "Shared Treasury";
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Back button & Title header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition shrink-0"
            title="Back to All Treasuries"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                {treasury.name}
              </h1>
              <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-300 border border-slate-700">
                {getCategoryLabel(treasury.category)}
              </span>
            </div>
            {treasury.description && (
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 sm:line-clamp-none">
                {treasury.description}
              </p>
            )}
          </div>
        </div>

        {/* Desktop Header Action Buttons */}
        <div className="hidden sm:flex items-center gap-2 flex-wrap">
          <button
            onClick={handleManualRefresh}
            className="flex items-center justify-center h-10 w-10 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
            title="Refresh treasury state"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin text-emerald-400" : ""}`} />
          </button>

          <button
            onClick={() => setIsContributeModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:text-white transition"
          >
            <Coins className="h-4 w-4 text-emerald-400" />
            <span>Add Funds</span>
          </button>

          <button
            onClick={() => setIsProposalModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-md shadow-emerald-600/30"
          >
            <Send className="h-4 w-4" />
            <span>Create Proposal</span>
          </button>
        </div>
      </div>

      {/* Active Signer Identity Banner */}
      <PersonaSwitcher
        currentMembers={members}
        tokenSymbol={treasury.tokenSymbol}
      />

      {/* Primary Financial & Governance Cards (§11.5) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Available Balance */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Available Treasury Balance</span>
            <Coins className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-white tracking-tight">
            {formatAmount(treasury.balance, treasury.tokenSymbol)}
          </div>
          <div className="text-xs text-emerald-400 font-medium">
            {treasury.tokenSymbol} on Testnet
          </div>
        </div>

        {/* Card 2: Governance Quorum Rule */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Governance Rule</span>
            <ShieldCheck className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-emerald-400 tracking-tight">
            {treasury.threshold} of {treasury.memberCount}
          </div>
          <div className="text-xs text-slate-400 font-medium">
            {Math.round((treasury.threshold / treasury.memberCount) * 100)}% quorum required to spend
          </div>
        </div>

        {/* Card 3: Pending Proposals */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Pending Proposals</span>
            <FileSpreadsheet className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-white tracking-tight">
            {pendingCount}
          </div>
          <div className="text-xs text-slate-400 font-medium">
            {proposals.length} total lifetime proposals
          </div>
        </div>

        {/* Card 4: Soroban Contract */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Smart Contract</span>
            <Code2 className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-sm font-bold font-mono tabular-nums text-slate-200 truncate mt-1">
            {formatAddress(treasury.contractAddress, 7)}
          </div>
          <div className="text-xs text-slate-400">
            <a
              href={getStellarExpertUrl("contract", treasury.contractAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
            >
              <span>View Explorer</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setActiveTab("proposals")}
            className={`flex items-center gap-2 px-4 py-2.5 font-bold transition border-b-2 shrink-0 ${
              activeTab === "proposals"
                ? "border-emerald-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Proposals ({proposals.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("members")}
            className={`flex items-center gap-2 px-4 py-2.5 font-bold transition border-b-2 shrink-0 ${
              activeTab === "members"
                ? "border-emerald-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Members ({members.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("deposits")}
            className={`flex items-center gap-2 px-4 py-2.5 font-bold transition border-b-2 shrink-0 ${
              activeTab === "deposits"
                ? "border-emerald-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Coins className="h-4 w-4" />
            <span>Deposits & Ledger</span>
          </button>

          <button
            onClick={() => setActiveTab("audit")}
            className={`flex items-center gap-2 px-4 py-2.5 font-bold transition border-b-2 shrink-0 ${
              activeTab === "audit"
                ? "border-emerald-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <History className="h-4 w-4" />
            <span>Audit Trail</span>
          </button>

          <button
            onClick={() => setActiveTab("contract")}
            className={`flex items-center gap-2 px-4 py-2.5 font-bold transition border-b-2 shrink-0 ${
              activeTab === "contract"
                ? "border-emerald-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Code2 className="h-4 w-4" />
            <span>Contract Inspector</span>
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      <div className="pt-2">
        {activeTab === "proposals" && (
          <ProposalsTab
            treasury={treasury}
            onRefresh={onRefresh}
            onCreateProposal={() => setIsProposalModalOpen(true)}
          />
        )}

        {activeTab === "members" && <MembersTab treasury={treasury} />}

        {activeTab === "deposits" && (
          <ContributionsTab
            treasury={treasury}
            onOpenContribute={() => setIsContributeModalOpen(true)}
          />
        )}

        {activeTab === "audit" && <AuditTab treasury={treasury} />}

        {activeTab === "contract" && (
          <ContractInspectorTab treasury={treasury} />
        )}
      </div>

      {/* Mobile Sticky Bottom Action Bar (§11.5 / §20) */}
      <div className="fixed bottom-14 left-0 right-0 z-30 sm:hidden border-t border-slate-800 bg-slate-950/95 p-3 backdrop-blur-lg flex items-center gap-2">
        <button
          onClick={() => setIsContributeModalOpen(true)}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 border border-slate-700 py-2.5 text-xs font-bold text-slate-200"
        >
          <Coins className="h-4 w-4 text-emerald-400" />
          <span>Add Funds</span>
        </button>

        <button
          onClick={() => setIsProposalModalOpen(true)}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/30"
        >
          <Send className="h-4 w-4" />
          <span>New Proposal</span>
        </button>
      </div>

      {/* Modals */}
      <CreateProposalModal
        isOpen={isProposalModalOpen}
        onClose={() => setIsProposalModalOpen(false)}
        treasury={treasury}
        onSuccess={onRefresh}
      />

      <ContributeModal
        isOpen={isContributeModalOpen}
        onClose={() => setIsContributeModalOpen(false)}
        treasury={treasury}
        onSuccess={onRefresh}
      />
    </div>
  );
}
