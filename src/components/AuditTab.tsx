"use client";

import React from "react";
import { Treasury } from "@/types";
import { formatAddress, formatDate, timeAgo } from "@/lib/utils";
import { getStellarExpertUrl } from "@/lib/stellar";
import {
  FileText,
  ExternalLink,
  ShieldCheck,
  Zap,
  Coins,
  Send,
  CheckCircle2,
  Receipt,
  XCircle,
} from "lucide-react";

interface AuditTabProps {
  treasury: Treasury;
}

export function AuditTab({ treasury }: AuditTabProps) {
  const auditLogs = treasury.auditLogs || [];

  const getActionBadge = (action: string) => {
    switch (action) {
      case "TREASURY_CREATED":
        return {
          label: "Treasury Deployed",
          color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
          icon: <ShieldCheck className="h-3.5 w-3.5" />,
        };
      case "FUNDS_CONTRIBUTED":
        return {
          label: "Funds Deposited",
          color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
          icon: <Coins className="h-3.5 w-3.5" />,
        };
      case "PROPOSAL_CREATED":
        return {
          label: "Proposal Submitted",
          color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
          icon: <Send className="h-3.5 w-3.5" />,
        };
      case "PROPOSAL_APPROVED":
        return {
          label: "Signature Recorded",
          color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        };
      case "PROPOSAL_THRESHOLD_REACHED":
        return {
          label: "Quorum Reached",
          color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
          icon: <Zap className="h-3.5 w-3.5" />,
        };
      case "PAYMENT_EXECUTED":
        return {
          label: "Payment Disbursed",
          color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
          icon: <Receipt className="h-3.5 w-3.5" />,
        };
      case "PROPOSAL_CANCELLED":
        return {
          label: "Proposal Cancelled",
          color: "bg-rose-500/10 text-rose-400 border-rose-500/20",
          icon: <XCircle className="h-3.5 w-3.5" />,
        };
      default:
        return {
          label: action,
          color: "bg-slate-800 text-slate-300 border-slate-700",
          icon: <FileText className="h-3.5 w-3.5" />,
        };
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h3 className="text-sm font-bold text-white">
          Cryptographic Governance Ledger
        </h3>
        <p className="text-xs text-slate-400">
          Complete transparent log of all Soroban transactions, multi-sig approvals, and payouts.
        </p>
      </div>

      {auditLogs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-10 text-center text-xs text-slate-400">
          No audit entries recorded yet.
        </div>
      ) : (
        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
          {auditLogs.map((log) => {
            const badge = getActionBadge(log.action);
            let parsedDetails: Record<string, unknown> = {};
            try {
              if (log.details) {
                parsedDetails = JSON.parse(log.details);
              }
            } catch {
              // fallback
            }

            return (
              <div key={log.id} className="relative group">
                {/* Node icon */}
                <div className="absolute -left-6 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 border border-slate-700 text-slate-400 group-hover:border-emerald-500 group-hover:text-emerald-400 transition">
                  <div className="h-2 w-2 rounded-full bg-slate-400 group-hover:bg-emerald-400" />
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-2 hover:border-slate-700 transition">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border ${badge.color}`}
                      >
                        {badge.icon}
                        {badge.label}
                      </span>
                      <span className="text-xs text-slate-300 font-semibold">
                        {log.actorLabel || formatAddress(log.actorAddress)}
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-400">
                      {formatDate(log.createdAt)} ({timeAgo(log.createdAt)})
                    </span>
                  </div>

                  {/* Detail contents */}
                  {Object.keys(parsedDetails).length > 0 && (
                    <div className="rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-300 space-y-1">
                      {Boolean(parsedDetails.title) && (
                        <div>
                          Title:{" "}
                          <strong className="text-white">
                            {String(parsedDetails.title)}
                          </strong>
                        </div>
                      )}
                      {Boolean(parsedDetails.amount) && (
                        <div>
                          Amount:{" "}
                          <strong className="text-emerald-400 font-mono">
                            {String(parsedDetails.amount)} {treasury.tokenSymbol}
                          </strong>
                        </div>
                      )}
                      {Boolean(parsedDetails.recipient) && (
                        <div className="font-mono text-[11px] text-slate-400">
                          Recipient: {formatAddress(String(parsedDetails.recipient), 8)}
                        </div>
                      )}
                      {parsedDetails.approvalCount !== undefined && (
                        <div>
                          Approvals:{" "}
                          <strong className="text-white">
                            {String(parsedDetails.approvalCount)} / {String(parsedDetails.threshold)}
                          </strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tx Hash */}
                  {log.txHash && (
                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400 font-mono">
                      <span>Stellar Soroban Tx: {formatAddress(log.txHash, 6)}</span>
                      <a
                        href={getStellarExpertUrl("tx", log.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                      >
                        <span>View Explorer</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
