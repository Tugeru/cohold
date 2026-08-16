"use client";

import React, { useState } from "react";
import { Proposal, Treasury } from "@/types";
import { formatAddress, formatAmount } from "@/lib/utils";
import { parseBaseUnits, parseNonNegativeBaseUnits } from "@/lib/money";
import {
  X,
  Zap,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Receipt,
  Building,
  CheckCircle2,
} from "lucide-react";

interface ExecutionConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: Proposal;
  treasury: Treasury;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}

export function ExecutionConfirmDialog({
  isOpen,
  onClose,
  proposal,
  treasury,
  onConfirm,
  isLoading,
}: ExecutionConfirmDialogProps) {
  if (!isOpen) return null;

  let remainingBalance = 0n;
  try {
    const currentBalance = parseNonNegativeBaseUnits(treasury.balance);
    const proposalAmount = parseBaseUnits(proposal.amount);
    remainingBalance = currentBalance >= proposalAmount
      ? currentBalance - proposalAmount
      : 0n;
  } catch {
    remainingBalance = 0n;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 p-0 sm:p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 sm:px-6 py-4 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Authorize & Disburse Payment
              </h2>
              <p className="text-xs text-slate-400">
                Review financial details before on-chain execution
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {/* Main Amount Card */}
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 text-center space-y-1">
            <div className="text-xs text-emerald-300 font-semibold uppercase tracking-wider">
              Disbursement Amount
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono text-emerald-400">
              {formatAmount(proposal.amount, treasury.tokenSymbol)}
            </div>
            <div className="text-xs text-slate-400 pt-1">
              From: <strong className="text-white">{treasury.name}</strong>
            </div>
          </div>

          {/* Details list */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="text-slate-400">Proposal Purpose:</span>
              <span className="font-semibold text-white text-right max-w-[240px] truncate">
                {proposal.title}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-800/80 pb-2">
              <span className="text-slate-400">Recipient Name:</span>
              <span className="font-semibold text-white">
                {proposal.recipientLabel || "Direct Address Recipient"}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-800/80 pb-2">
              <span className="text-slate-400">Recipient Stellar Address:</span>
              <span className="font-mono text-cyan-300 text-[11px] break-all">
                {formatAddress(proposal.recipientAddress, 8)}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="text-slate-400">Governance Status:</span>
              <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {proposal.approvalCount} of {proposal.threshold} Signatures (Quorum Met)
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-400">Remaining Balance:</span>
              <span className="font-mono font-bold text-slate-200">
                {formatAmount(remainingBalance, treasury.tokenSymbol)}
              </span>
            </div>
          </div>

          {/* Reassurance Notice */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-[11px] text-slate-400 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <p>
              Once confirmed, tokens will be permanently transferred from the
              Soroban smart contract to the recipient. This payment cannot be
              re-executed.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-800 px-5 sm:px-6 py-4 bg-slate-950 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-white transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-2.5 text-xs font-bold text-white hover:from-emerald-400 hover:to-teal-400 transition shadow-lg shadow-emerald-500/30"
          >
            {isLoading ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Executing Transfer...</span>
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                <span>Confirm & Disburse Payment</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
