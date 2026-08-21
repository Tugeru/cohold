"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Proposal, Treasury } from "@/types";
import { useWallet } from "@/context/WalletContext";
import { APP_ROUTES } from "@/lib/app-routes";
import { formatAmount, formatAddress, timeAgo, prefersReducedMotion } from "@/lib/utils";
import { getStellarExpertUrl } from "@/lib/stellar";
import { ExecutionConfirmDialog } from "./ExecutionConfirmDialog";
import confetti from "canvas-confetti";
import {
  Clock,
  CheckCircle2,
  Receipt,
  FileSpreadsheet,
  Send,
  Zap,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Filter,
  Check,
} from "lucide-react";

interface GlobalProposalsViewProps {
  proposals: (Proposal & { treasury?: Partial<Treasury> })[];
  treasuries: Treasury[];
  onRefresh: () => void;
}

export function GlobalProposalsView({
  proposals,
  treasuries,
  onRefresh,
}: GlobalProposalsViewProps) {
  const {
    activePersona,
    canPerformStateChange,
    walletActionBlockReason,
  } = useWallet();
  const [activeFilter, setActiveFilter] = useState<
    "needs_my_approval" | "pending" | "approved" | "executed" | "all"
  >("needs_my_approval");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [executingProposal, setExecutingProposal] = useState<{
    proposal: Proposal;
    treasury: Treasury;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error";
    title: string;
    text: string;
  } | null>(null);

  const showToast = (type: "success" | "error", title: string, text: string) => {
    setToastMessage({ type, title, text });
    setTimeout(() => setToastMessage(null), 6000);
  };

  const walletActionAllowed = () => {
    if (canPerformStateChange) return true;
    showToast(
      "error",
      "Wallet action blocked",
      walletActionBlockReason || "Wallet action is blocked."
    );
    return false;
  };

  const filteredProposals = proposals.filter((p) => {
    const approvals = p.approvals || [];
    const hasApproved = approvals.some(
      (a) => a.approverAddress.toUpperCase() === activePersona.address.toUpperCase()
    );

    if (activeFilter === "needs_my_approval") {
      return p.status === "pending" && !hasApproved;
    }
    if (activeFilter === "pending") return p.status === "pending";
    if (activeFilter === "approved") return p.status === "approved";
    if (activeFilter === "executed") return p.status === "executed";
    return true;
  });

  const handleApprove = async (p: Proposal) => {
    if (!walletActionAllowed()) return;
    setActionLoading(`approve-${p.id}`);
    try {
      const res = await fetch(`/api/proposals/${p.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approverAddress: activePersona.address,
          approverLabel: `${activePersona.name} (${activePersona.role})`,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        showToast("error", "Approval Rejected", data.error || "Approval failed");
      } else {
        if (data.isThresholdReached) {
          showToast(
            "success",
            "Quorum Reached!",
            `Signed by ${activePersona.name}. Proposal has ${data.approvalCount}/${data.threshold} approvals and is READY TO EXECUTE.`
          );
          if (!prefersReducedMotion()) confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        } else {
          showToast(
            "success",
            "Signature Recorded",
            `Signed by ${activePersona.name}. (${data.approvalCount}/${data.threshold} approvals)`
          );
        }
        onRefresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Approval failed";
      showToast("error", "Network Error", msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleExecuteConfirmed = async () => {
    if (!executingProposal) return;
    if (!walletActionAllowed()) return;
    const { proposal, treasury } = executingProposal;
    setActionLoading(`execute-${proposal.id}`);
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          executorAddress: activePersona.address,
          executorLabel: `${activePersona.name} (${activePersona.role})`,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        showToast("error", "Execution Blocked", data.error || "Execution failed");
      } else {
        showToast(
          "success",
          "Payment Executed & Disbursed!",
          `Transferred ${formatAmount(proposal.amount, treasury.tokenSymbol)} to ${proposal.recipientLabel || formatAddress(proposal.recipientAddress)}.`
        );
        if (!prefersReducedMotion()) confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
        setExecutingProposal(null);
        onRefresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Execution failed";
      showToast("error", "Execution Error", msg);
    } finally {
      setActionLoading(null);
    }
  };

  const openExecutionDialog = (p: Proposal) => {
    if (!walletActionAllowed()) return;
    const t = treasuries.find((item) => item.id === p.treasuryId);
    if (!t) {
      showToast("error", "Treasury Error", "Treasury details not found");
      return;
    }
    setExecutingProposal({ proposal: p, treasury: t });
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div
          className={`rounded-2xl border p-4 text-xs flex items-start gap-3 shadow-xl animate-in fade-in ${
            toastMessage.type === "success"
              ? "border-emerald-500/40 bg-emerald-950/90 text-emerald-200"
              : "border-rose-500/40 bg-rose-950/90 text-rose-200"
          }`}
        >
          {toastMessage.type === "success" ? (
            <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <div className="font-bold text-white text-sm">{toastMessage.title}</div>
            <div className="mt-1 leading-relaxed">{toastMessage.text}</div>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Spending Proposals</h1>
          <p className="text-xs text-slate-400">
            Consolidated review and approval status across all shared treasuries
          </p>
          <span className="mt-2 inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300">
            Demo mode · fixture amounts — no Testnet transactions
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setActiveFilter("needs_my_approval")}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-semibold transition shrink-0 ${
              activeFilter === "needs_my_approval"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <Clock className="h-3.5 w-3.5 text-amber-400" />
            <span>Needs My Approval</span>
          </button>

          <button
            onClick={() => setActiveFilter("approved")}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-semibold transition shrink-0 ${
              activeFilter === "approved"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <Zap className="h-3.5 w-3.5 text-emerald-400" />
            <span>Ready to Execute</span>
          </button>

          <button
            onClick={() => setActiveFilter("pending")}
            className={`rounded-xl px-3.5 py-2 font-semibold transition shrink-0 ${
              activeFilter === "pending"
                ? "bg-slate-800 text-white"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            Pending
          </button>

          <button
            onClick={() => setActiveFilter("executed")}
            className={`rounded-xl px-3.5 py-2 font-semibold transition shrink-0 ${
              activeFilter === "executed"
                ? "bg-slate-800 text-white"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            Executed
          </button>

          <button
            onClick={() => setActiveFilter("all")}
            className={`rounded-xl px-3.5 py-2 font-semibold transition shrink-0 ${
              activeFilter === "all"
                ? "bg-slate-800 text-white"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            All ({proposals.length})
          </button>
        </div>
      </div>

      {filteredProposals.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-950/40 p-12 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-slate-500">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-white">No proposals found for this view</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {activeFilter === "needs_my_approval"
              ? "You have already reviewed all pending proposals, or no proposals are currently requesting your approval."
              : "No proposals match the selected filter criteria."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProposals.map((p) => {
            const approvalsList = p.approvals || [];
            const hasActiveUserApproved = approvalsList.some(
              (a) => a.approverAddress.toUpperCase() === activePersona.address.toUpperCase()
            );
            const isApproved = p.status === "approved";
            const isExecuted = p.status === "executed";
            const isPending = p.status === "pending";
            const matchingTreasury = treasuries.find((t) => t.id === p.treasuryId);
            const tokenSym = matchingTreasury?.tokenSymbol || "DEMO";

            return (
              <div
                key={p.id}
                className={`rounded-2xl border p-5 bg-slate-900/80 shadow-lg space-y-4 transition ${
                  isApproved
                    ? "border-emerald-500/50 bg-gradient-to-br from-slate-900 to-emerald-950/20"
                    : isExecuted
                    ? "border-slate-800 opacity-90"
                    : "border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isPending && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-400 border border-amber-500/20">
                        <Clock className="h-3.5 w-3.5" />
                        Pending Approvals ({p.approvalCount}/{p.threshold})
                      </span>
                    )}
                    {isApproved && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Ready to Disburse ({p.approvalCount}/{p.threshold} Quorum Met)
                      </span>
                    )}
                    {isExecuted && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-bold text-slate-300 border border-slate-700">
                        <Receipt className="h-3.5 w-3.5 text-emerald-400" />
                        Disbursed & Executed
                      </span>
                    )}

                    <Link
                      href={APP_ROUTES.treasury(p.treasuryId)}
                      className="rounded-md bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-slate-700 transition"
                    >
                      {matchingTreasury?.name || "Treasury"}
                    </Link>

                    <span className="text-[11px] text-slate-400">Created {timeAgo(p.createdAt)}</span>
                  </div>

                  <div className="text-left sm:text-right">
                    <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-emerald-400">
                      {formatAmount(p.amount, tokenSym)}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white">{p.title}</h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">{p.description}</p>
                </div>

                <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="text-slate-400">Recipient: </span>
                    <strong className="text-white">
                      {p.recipientLabel || formatAddress(p.recipientAddress)}
                    </strong>
                    <span className="text-[11px] font-mono tabular-nums text-slate-400 ml-2 hidden sm:inline">
                      ({formatAddress(p.recipientAddress, 6)})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Quorum:</span>
                    <span className="font-mono tabular-nums font-bold text-emerald-400">
                      {p.approvalCount} of {p.threshold} Signatures
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-slate-400">
                    {hasActiveUserApproved && isPending && (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" />
                        You have approved this proposal.
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={APP_ROUTES.treasury(p.treasuryId)}
                      className="rounded-xl bg-slate-800 hover:bg-slate-750 px-3.5 py-2 text-xs font-semibold text-slate-200 transition"
                    >
                      View Treasury Details
                    </Link>

                    {isPending && !hasActiveUserApproved && (
                      <button
                        onClick={() => handleApprove(p)}
                        disabled={actionLoading === `approve-${p.id}`}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-md shadow-emerald-600/30"
                      >
                        {actionLoading === `approve-${p.id}` ? (
                          <>
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            <span>Signing...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Approve as {activePersona.name.split(" ")[0]}</span>
                          </>
                        )}
                      </button>
                    )}

                    {isApproved && (
                      <button
                        onClick={() => openExecutionDialog(p)}
                        className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-bold text-white hover:from-emerald-400 hover:to-teal-400 transition shadow-md shadow-emerald-500/30"
                      >
                        <Zap className="h-4 w-4" />
                        <span>Execute Disbursal</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {executingProposal && (
        <ExecutionConfirmDialog
          isOpen={Boolean(executingProposal)}
          onClose={() => setExecutingProposal(null)}
          proposal={executingProposal.proposal}
          treasury={executingProposal.treasury}
          onConfirm={handleExecuteConfirmed}
          isLoading={actionLoading === `execute-${executingProposal.proposal.id}`}
        />
      )}
    </div>
  );
}
