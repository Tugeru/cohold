"use client";

import React, { useState } from "react";
import { useModalA11y } from "@/components/useModalA11y";
import { useWallet } from "@/context/WalletContext";
import { Treasury, TreasuryMember } from "@/types";
import { parseBaseUnits } from "@/lib/money";
import {
  X,
  Coins,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowDownCircle,
} from "lucide-react";

interface ContributeModalProps {
  isOpen: boolean;
  onClose: () => void;
  treasury: Treasury;
  onSuccess: () => void;
}

export function ContributeModal({
  isOpen,
  onClose,
  treasury,
  onSuccess,
}: ContributeModalProps) {
  const { activePersona, canPerformStateChange, walletActionBlockReason } = useWallet();
  const [amount, setAmount] = useState("1000");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useModalA11y(onClose, loading, isOpen);

  if (!isOpen) return null;

  // Verify membership
  const members = treasury.members || [];
  const isMember = members.some(
    (m) => m.address.toUpperCase() === activePersona.address.toUpperCase()
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let amountUnits: bigint;
    try {
      amountUnits = parseBaseUnits(amount);
    } catch {
      setError("Please enter a positive integer base-unit amount (FR-2).");
      return;
    }

    if (!isMember) {
      setError(
        `Address ${activePersona.name} (${activePersona.role}) is not an authorized member of this treasury. Only members may deposit funds in MVP.`
      );
      return;
    }

    if (!canPerformStateChange) {
      setError(walletActionBlockReason || "Wallet action is blocked.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/treasuries/${treasury.id}/contribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberAddress: activePersona.address,
          memberLabel: `${activePersona.name} (${activePersona.role})`,
          amount: amountUnits.toString(),
          note: note.trim(),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Deposit failed");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Deposit failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`Contribute to ${treasury.name}`} tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Contribute Funds</h2>
              <p className="text-xs text-slate-400">{treasury.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actor Info */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-xl">{activePersona.avatar}</span>
              <div>
                <div className="font-semibold text-white">{activePersona.name}</div>
                <div className="text-slate-400">{activePersona.role}</div>
              </div>
            </div>
            {isMember ? (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                Authorized Member
              </span>
            ) : (
              <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/20">
                Non-Member (Deposit Blocked)
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">
              Contribution Amount ({treasury.tokenSymbol}) *
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000"
                min="1"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-base font-mono tabular-nums text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
              />
              <div className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400">
                {treasury.tokenSymbol}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">
              Deposit Note / Memo (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Q2 Membership Dues, Sponsorship Grant"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1 text-slate-300 font-semibold">
              <Lock className="h-3.5 w-3.5 text-emerald-400" />
              <span>Smart Contract Custody</span>
            </div>
            <p>
              Assets are deposited directly into the Stellar Soroban contract
              address and can only be withdrawn after reaching the{" "}
              <strong className="text-white">
                {treasury.threshold} of {treasury.memberCount}
              </strong>{" "}
              approval threshold.
            </p>
          </div>

          {/* Submit */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !isMember}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md shadow-emerald-600/30"
            >
              {loading ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Transferring...</span>
                </>
              ) : (
                <>
                  <ArrowDownCircle className="h-4 w-4" />
                  <span>Confirm Deposit</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
