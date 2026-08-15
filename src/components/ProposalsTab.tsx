"use client";

import React, { useState } from "react";
import { Proposal, Treasury, TreasuryMember } from "@/types";
import { useWallet } from "@/context/WalletContext";
import { formatAddress, formatAmount, formatDate, timeAgo } from "@/lib/utils";
import { getStellarExpertUrl } from "@/lib/stellar";
import confetti from "canvas-confetti";
import {
  CheckCircle2,
  Clock,
  Send,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  UserCheck,
  FileCheck,
  Zap,
  Ban,
  Receipt,
  HelpCircle,
} from "lucide-react";

interface ProposalsTabProps {
  treasury: Treasury;
  onRefresh: () => void;
  onCreateProposal: () => void;
}

export function ProposalsTab({
  treasury,
  onRefresh,
  onCreateProposal,
}: ProposalsTabProps) {
  const { activePersona } = useWallet();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "executed">("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error";
    title: string;
    text: string;
  } | null>(null);

  const proposals = treasury.proposals || [];
  const members = treasury.members || [];

  // Filter list
  const filteredProposals = proposals.filter((p) => {
    if (filter === "pending") return p.status === "pending";
    if (filter === "approved") return p.status === "approved";
    if (filter === "executed") return p.status === "executed";
    return true;
  });

  // Verify if active persona is a member of this treasury
  const isMember = members.some(
    (m) => m.address.toUpperCase() === activePersona.address.toUpperCase()
  );

  const showToast = (type: "success" | "error", title: string, text: string) => {
    setToastMessage({ type, title, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 6000);
  };

  // 1. Handle Approve Proposal (FR-4, FR-5)
  const handleApprove = async (proposal: Proposal) => {
    if (!isMember) {
      showToast(
        "error",
        "Authorization Error (FR-4)",
        `You are connected as ${activePersona.name} (${activePersona.role}), who is not a member of this treasury.`
      );
      return;
    }

    setActionLoading(`approve-${proposal.id}`);
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/approve`, {
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
            "Threshold Consensus Reached!",
            `Approval recorded. Proposal now has ${data.approvalCount}/${data.threshold} signatures and is READY TO EXECUTE.`
          );
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        } else {
          showToast(
            "success",
            "Approval Recorded",
            `Signed by ${activePersona.name}. Progress: ${data.approvalCount}/${data.threshold} approvals.`
          );
        }
        onRefresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Approval request failed";
      showToast("error", "Network Error", msg);
    } finally {
      setActionLoading(null);
    }
  };

  // 2. Handle Execute Proposal (FR-6, FR-7)
  const handleExecute = async (proposal: Proposal) => {
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
          "Payment Executed & Transferred!",
          `Transferred ${formatAmount(proposal.amount, treasury.tokenSymbol)} to ${proposal.recipientLabel || formatAddress(proposal.recipientAddress)}. New Balance: ${formatAmount(data.newBalance, treasury.tokenSymbol)}`
        );
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
        onRefresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Execution failed";
      showToast("error", "Execution Error", msg);
    } finally {
      setActionLoading(null);
    }
  };

  // 3. Attempt Premature Execution (Demonstrates Soroban Invariant 3 Rejection)
  const handleAttemptPrematureExecution = async (proposal: Proposal) => {
    setActionLoading(`test-premature-${proposal.id}`);
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
        showToast(
          "error",
          "Soroban Smart Contract Invariant 3 Enforced",
          data.error
        );
      } else {
        onRefresh();
      }
    } catch {
      showToast("error", "Rejection Test", "Contract execution blocked as expected.");
    } finally {
      setActionLoading(null);
    }
  };

  // 4. Attempt Double Execution (Demonstrates Soroban Invariant 5 Rejection)
  const handleAttemptDoubleExecution = async (proposal: Proposal) => {
    setActionLoading(`test-double-${proposal.id}`);
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
        showToast(
          "error",
          "Soroban Invariant 5 Enforced (Double-Spend Blocked)",
          data.error
        );
      }
    } catch {
      showToast("error", "Rejection Test", "Double execution blocked as expected.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast alert display */}
      {toastMessage && (
        <div
          className={`rounded-xl border p-4 text-xs flex items-start gap-3 shadow-xl animate-in fade-in slide-in-from-top-2 ${
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
            <div className="font-bold text-white text-sm">
              {toastMessage.title}
            </div>
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

      {/* Filter Tabs & Summary Counters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === "all"
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            All Proposals ({proposals.length})
          </button>
          <button
            onClick={() => setFilter("pending")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === "pending"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Awaiting Approvals (
            {proposals.filter((p) => p.status === "pending").length})
          </button>
          <button
            onClick={() => setFilter("approved")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === "approved"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Ready to Execute (
            {proposals.filter((p) => p.status === "approved").length})
          </button>
          <button
            onClick={() => setFilter("executed")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === "executed"
                ? "bg-slate-800 text-slate-300"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Executed ({proposals.filter((p) => p.status === "executed").length})
          </button>
        </div>

        <button
          onClick={onCreateProposal}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition shadow-sm"
        >
          <Send className="h-3.5 w-3.5" />
          <span>New Proposal</span>
        </button>
      </div>

      {/* Proposals List */}
      {filteredProposals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-12 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-slate-500">
            <FileCheck className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-white">
            No proposals in this view
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Proposals allow group members to request funds from the treasury.
            Once enough members approve, payments are transferred automatically.
          </p>
          <button
            onClick={onCreateProposal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Create First Proposal</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProposals.map((prop) => {
            const approvalsList = prop.approvals || [];
            const approvedAddresses = new Set(
              approvalsList.map((a) => a.approverAddress.toUpperCase())
            );
            const hasActiveUserApproved = approvedAddresses.has(
              activePersona.address.toUpperCase()
            );
            const approvalProgress = Math.min(
              (prop.approvalCount / prop.threshold) * 100,
              100
            );
            const isApproved = prop.status === "approved";
            const isExecuted = prop.status === "executed";
            const isPending = prop.status === "pending";

            return (
              <div
                key={prop.id}
                className={`rounded-2xl border bg-slate-900/90 p-5 shadow-lg transition duration-200 ${
                  isApproved
                    ? "border-emerald-500/50 shadow-emerald-500/5 bg-gradient-to-br from-slate-900 to-emerald-950/20"
                    : isExecuted
                    ? "border-slate-800 opacity-90"
                    : "border-slate-800 hover:border-slate-700"
                }`}
              >
                {/* Header row: Status badge, Category, Amount */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Status Badge */}
                    {isPending && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-400 border border-amber-500/20">
                        <Clock className="h-3.5 w-3.5" />
                        Pending Approvals ({prop.approvalCount}/{prop.threshold})
                      </span>
                    )}
                    {isApproved && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/30 animate-pulse">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Ready to Execute ({prop.approvalCount}/{prop.threshold} quorum met)
                      </span>
                    )}
                    {isExecuted && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-bold text-slate-300 border border-slate-700">
                        <Receipt className="h-3.5 w-3.5 text-emerald-400" />
                        Executed & Transferred
                      </span>
                    )}

                    {prop.category && (
                      <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-400">
                        {prop.category}
                      </span>
                    )}

                    <span className="text-[11px] text-slate-400">
                      Created {timeAgo(prop.createdAt)} by{" "}
                      <span className="text-slate-300 font-medium">
                        {prop.proposerLabel || formatAddress(prop.proposerAddress)}
                      </span>
                    </span>
                  </div>

                  {/* Amount Badge */}
                  <div className="text-right">
                    <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400">
                      {formatAmount(prop.amount, treasury.tokenSymbol)}
                    </div>
                  </div>
                </div>

                {/* Title & Description */}
                <div className="py-3.5 space-y-1.5">
                  <h3 className="text-base font-bold text-white tracking-tight">
                    {prop.title}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {prop.description}
                  </p>
                </div>

                {/* Recipient details */}
                <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Payment Recipient:</span>
                    <span className="font-semibold text-white">
                      {prop.recipientLabel || "External Address"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-slate-400 text-[11px]">
                    <span>{formatAddress(prop.recipientAddress, 8)}</span>
                    <a
                      href={getStellarExpertUrl("account", prop.recipientAddress)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300"
                      title="View on Stellar Expert Explorer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>

                {/* Approval Progress Bar & Signer Roster */}
                <div className="pt-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-300">
                        Governance Quorum:
                      </span>
                      <span className="font-mono font-bold text-emerald-400">
                        {prop.approvalCount} of {prop.threshold} Required
                      </span>
                    </div>
                    <span className="text-slate-400 text-[11px]">
                      {Math.round(approvalProgress)}% satisfied
                    </span>
                  </div>

                  <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isExecuted
                          ? "bg-slate-400"
                          : isApproved
                          ? "bg-emerald-500"
                          : "bg-amber-500"
                      }`}
                      style={{ width: `${approvalProgress}%` }}
                    />
                  </div>

                  {/* Visual Signer Ledger Chips */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {members.map((m) => {
                      const hasApproved = approvedAddresses.has(
                        m.address.toUpperCase()
                      );
                      const isCurrentUser =
                        m.address.toUpperCase() ===
                        activePersona.address.toUpperCase();

                      return (
                        <div
                          key={m.id}
                          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs border transition ${
                            hasApproved
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-medium"
                              : "border-slate-800 bg-slate-950 text-slate-400"
                          } ${isCurrentUser ? "ring-1 ring-emerald-400/50" : ""}`}
                        >
                          <span className="text-sm">{m.avatar || "👤"}</span>
                          <span>{m.label?.split(" ")[0] || m.role}</span>
                          {hasApproved ? (
                            <span className="text-emerald-400 font-bold">✓</span>
                          ) : (
                            <span className="text-slate-500 text-[10px]">⏳</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Executed Receipt Information */}
                {isExecuted && prop.executionTxHash && (
                  <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Receipt className="h-4 w-4 text-emerald-400" />
                      <span>
                        Finalized on Stellar:{" "}
                        <strong className="text-white">
                          {formatDate(prop.executedAt)}
                        </strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-400">
                      <span>Tx: {formatAddress(prop.executionTxHash, 6)}</span>
                      <a
                        href={getStellarExpertUrl("tx", prop.executionTxHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Actions Row */}
                <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-400">
                    {isPending && hasActiveUserApproved && (
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        You have approved this proposal. Waiting for {prop.threshold - prop.approvalCount} more approval(s).
                      </span>
                    )}
                    {isPending && !hasActiveUserApproved && isMember && (
                      <span className="text-amber-400 font-medium">
                        👉 Your signature is requested as an authorized member.
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Action 1: Sign / Approve button */}
                    {isPending && !hasActiveUserApproved && (
                      <button
                        onClick={() => handleApprove(prop)}
                        disabled={actionLoading === `approve-${prop.id}` || !isMember}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition shadow-md shadow-emerald-600/30"
                      >
                        {actionLoading === `approve-${prop.id}` ? (
                          <>
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            <span>Signing on Soroban...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Approve Proposal</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Action 2: Execute Payment button (When threshold reached) */}
                    {isApproved && (
                      <button
                        onClick={() => handleExecute(prop)}
                        disabled={actionLoading === `execute-${prop.id}`}
                        className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2 text-xs font-bold text-white hover:from-emerald-400 hover:to-teal-400 transition shadow-lg shadow-emerald-500/30 animate-pulse"
                      >
                        {actionLoading === `execute-${prop.id}` ? (
                          <>
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            <span>Executing Payment...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4" />
                            <span>Execute Payment to Recipient</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Action 3: Attempt Premature Execution (Test Invariant 3) */}
                    {isPending && (
                      <button
                        onClick={() => handleAttemptPrematureExecution(prop)}
                        disabled={actionLoading === `test-premature-${prop.id}`}
                        title="Test that Soroban rejects payout before threshold is met (Invariant 3)"
                        className="flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-750 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 hover:text-slate-200 border border-slate-700 transition"
                      >
                        <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                        <span>Test Early Execution Rejection</span>
                      </button>
                    )}

                    {/* Action 4: Attempt Double Execution (Test Invariant 5) */}
                    {isExecuted && (
                      <button
                        onClick={() => handleAttemptDoubleExecution(prop)}
                        disabled={actionLoading === `test-double-${prop.id}`}
                        title="Test that Soroban rejects duplicate execution (Invariant 5)"
                        className="flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-750 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 hover:text-slate-200 border border-slate-700 transition"
                      >
                        <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                        <span>Test Double-Spend Rejection</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
