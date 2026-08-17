"use client";

import React from "react";
import {
  type ChainProposalStatus,
  type CurrentUserApproval,
} from "@/lib/contract-adapter";
import {
  BadgeCheck,
  CircleHelp,
  Clock,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Radio,
} from "lucide-react";

const STATUS_STYLES: Record<ChainProposalStatus, string> = {
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  approved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  executed: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
  cancelled: "border-slate-600 bg-slate-800/60 text-slate-400",
};

const STATUS_LABELS: Record<ChainProposalStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  executed: "Executed",
  cancelled: "Cancelled",
};

export function WalletStatusChip({ status }: { status: ChainProposalStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[status]}`}
    >
      {status === "pending" && <Clock className="h-3 w-3" />}
      {status === "approved" && <CheckCircle2 className="h-3 w-3" />}
      {status === "executed" && <Radio className="h-3 w-3" />}
      {status === "cancelled" && <XCircle className="h-3 w-3" />}
      {STATUS_LABELS[status]}
    </span>
  );
}

/**
 * Current-user approval state. `unknown` is explicit: it is never rendered as
 * "approved" or as an actionable "you can still approve".
 */
export function WalletApprovalChip({
  state,
  walletConnected,
}: {
  state: CurrentUserApproval;
  walletConnected: boolean;
}) {
  if (state === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
        <BadgeCheck className="h-3 w-3" />
        You approved
      </span>
    );
  }
  if (state === "not-approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
        <MinusCircle className="h-3 w-3" />
        You haven&apos;t approved
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-slate-400"
      title={
        walletConnected
          ? "Approval status is unavailable until membership and approval reads succeed"
          : "Connect a wallet on Stellar Testnet to see your approval status"
      }
    >
      <CircleHelp className="h-3 w-3" />
      {walletConnected
        ? "Approval status unknown"
        : "Connect Freighter to see your approval status"}
    </span>
  );
}

export function WalletApprovalRail({
  approvalCount,
  threshold,
  membersCount,
}: {
  approvalCount: number;
  threshold: number;
  membersCount?: number;
}) {
  const pct = threshold > 0 ? Math.min(100, Math.round((approvalCount / threshold) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] text-slate-400">
        <span className="font-medium">
          Approval rule:{" "}
          {membersCount !== undefined && membersCount > 0
            ? `${threshold} of ${membersCount} members`
            : `${threshold} required`}
        </span>
      </div>
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>
          Current approvals:{" "}
          <span className="font-semibold text-slate-200 tabular-nums">
            {approvalCount} of {threshold} required
          </span>
        </span>
        <span className="font-mono tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}