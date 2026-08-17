"use client";

import React, { useCallback, useState, useEffect } from "react";
import { formatAddress, formatDate, timeAgo } from "@/lib/utils";
import {
  History,
  Coins,
  Send,
  CheckCircle2,
  Zap,
  Receipt,
  ShieldCheck,
  Filter,
  RefreshCw,
  Info,
} from "lucide-react";

export function GlobalActivityView() {
  const [activities, setActivities] = useState<
    Array<{
      id: string;
      treasuryId: string;
      action: string;
      actorAddress: string;
      actorLabel?: string | null;
      details?: string | null;
      txHash?: string | null;
      createdAt: string | Date;
      treasury?: { id: string; name: string; category: string; tokenSymbol: string };
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "contributions" | "proposals" | "approvals" | "payments">("all");

  const fetchActivity = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/activity?action=${filter}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load activity records.");
      }
      setActivities(data.activities || []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load activity records.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchActivity();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchActivity]);

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
          label: "Deposit Recorded",
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
      default:
        return {
          label: action,
          color: "bg-slate-800 text-slate-300 border-slate-700",
          icon: <History className="h-3.5 w-3.5" />,
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Activity
          </h1>
          <p className="text-xs text-slate-400">
            Fixture records for the demo walk — none of these rows are
            confirmed Testnet transactions.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-xl px-3 py-1.5 font-semibold transition shrink-0 ${
              filter === "all"
                ? "bg-slate-800 text-white"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            All Activity
          </button>
          <button
            onClick={() => setFilter("contributions")}
            className={`rounded-xl px-3 py-1.5 font-semibold transition shrink-0 ${
              filter === "contributions"
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            Deposits
          </button>
          <button
            onClick={() => setFilter("proposals")}
            className={`rounded-xl px-3 py-1.5 font-semibold transition shrink-0 ${
              filter === "proposals"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            Proposals
          </button>
          <button
            onClick={() => setFilter("approvals")}
            className={`rounded-xl px-3 py-1.5 font-semibold transition shrink-0 ${
              filter === "approvals"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            Approvals
          </button>
          <button
            onClick={() => setFilter("payments")}
            className={`rounded-xl px-3 py-1.5 font-semibold transition shrink-0 ${
              filter === "payments"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            Payments
          </button>
        </div>
      </div>

      {/* Demo-mode notice: fixtures are not confirmed transactions */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200 flex items-start gap-2.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p>
          <strong>Demo activity.</strong> Every row below is fixture data for
          the guided demo. None of these records correspond to a confirmed
          Stellar Testnet transaction.
        </p>
      </div>

      {/* Activity Timeline */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400 space-y-2">
          <RefreshCw className="h-5 w-5 animate-spin mx-auto text-emerald-400" />
          <p>Loading activity records...</p>
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-12 text-center text-xs text-slate-300 space-y-3">
          <p>{error}</p>
          <button type="button" onClick={() => void fetchActivity()} className="rounded-xl bg-slate-800 px-4 py-2 font-semibold text-white hover:bg-slate-700">
            Retry
          </button>
        </div>
      ) : activities.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-950/40 p-12 text-center text-xs text-slate-400">
          No activity logs recorded for this filter.
        </div>
      ) : (
        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
          {activities.map((item) => {
            const badge = getActionBadge(item.action);
            let detailsObj: Record<string, unknown> = {};
            try {
              if (item.details) detailsObj = JSON.parse(item.details);
            } catch {
              // ignore
            }

            return (
              <div key={item.id} className="relative group">
                <div className="absolute -left-6 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 border border-slate-700 text-slate-400 group-hover:border-emerald-500 group-hover:text-emerald-400 transition">
                  <div className="h-2 w-2 rounded-full bg-slate-400 group-hover:bg-emerald-400" />
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 space-y-2 hover:border-slate-700 transition">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border ${badge.color}`}
                      >
                        {badge.icon}
                        {badge.label}
                      </span>

                      {item.treasury && (
                        <span className="text-xs font-semibold text-emerald-400">
                          {item.treasury.name}
                        </span>
                      )}

                      <span className="text-xs text-slate-300 font-medium">
                        by {item.actorLabel || formatAddress(item.actorAddress)}
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-400">
                      {formatDate(item.createdAt)} ({timeAgo(item.createdAt)})
                    </span>
                  </div>

                  {/* Summary details */}
                  {Object.keys(detailsObj).length > 0 && (
                    <div className="rounded-xl bg-slate-950 p-3 text-xs text-slate-300 space-y-1">
                      {Boolean(detailsObj.title) && (
                        <div>
                          Title:{" "}
                          <strong className="text-white">
                            {String(detailsObj.title)}
                          </strong>
                        </div>
                      )}
                      {Boolean(detailsObj.amount) && (
                        <div>
                          Amount:{" "}
                          <strong className="text-emerald-400 font-mono tabular-nums">
                            {String(detailsObj.amount)}{" "}
                            {item.treasury?.tokenSymbol || "DEMO"}
                          </strong>
                        </div>
                      )}
                      {Boolean(detailsObj.recipient) && (
                        <div className="font-mono tabular-nums text-[11px] text-slate-400">
                          Recipient: {formatAddress(String(detailsObj.recipient), 8)}
                        </div>
                      )}
                      {detailsObj.approvalCount !== undefined && (
                        <div>
                          Quorum:{" "}
                          <strong className="text-white">
                            {String(detailsObj.approvalCount)} of{" "}
                            {String(detailsObj.threshold)} Approvals
                          </strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Demo records carry no real chain transaction */}
                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 font-semibold text-slate-400">
                      <Info className="h-3 w-3" />
                      Demo record · no chain transaction
                    </span>
                    {item.txHash && (
                      <span className="font-mono tabular-nums">
                        fixture id {formatAddress(item.txHash, 6)}
                      </span>
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
