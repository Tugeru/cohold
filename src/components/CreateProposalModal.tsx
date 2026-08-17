"use client";

import React, { useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { Treasury } from "@/types";
import { isValidStellarAddress } from "@/lib/stellar";
import { parseBaseUnits } from "@/lib/money";
import { formatAmount } from "@/lib/utils";
import {
  X,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Building,
  User,
  PlusCircle,
  HelpCircle,
} from "lucide-react";

interface CreateProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  treasury: Treasury;
  onSuccess: () => void;
}

export function CreateProposalModal({
  isOpen,
  onClose,
  treasury,
  onSuccess,
}: CreateProposalModalProps) {
  const { activePersona, canPerformStateChange, walletActionBlockReason } = useWallet();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Venue & Logistics");
  const [amount, setAmount] = useState("4500");
  const [recipientAddress, setRecipientAddress] = useState(
    "GAVENUE999HOTELCENTRALHALLTESTNETRECIPIENT1"
  );
  const [recipientLabel, setRecipientLabel] = useState(
    "University Convention Center"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Membership check
  const members = treasury.members || [];
  const isMember = members.some(
    (m) => m.address.toUpperCase() === activePersona.address.toUpperCase()
  );

  const setSampleRecipient = (name: string, addr: string, cat: string, amt: string, desc: string) => {
    setTitle(name);
    setRecipientLabel(name);
    setRecipientAddress(addr);
    setCategory(cat);
    setAmount(amt);
    setDescription(desc);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Please enter a proposal title.");
      return;
    }

    if (!description.trim()) {
      setError("Please enter a description / purpose for the expenditure.");
      return;
    }

    let amountUnits: bigint;
    try {
      amountUnits = parseBaseUnits(amount);
    } catch {
      setError("Amount must be a positive integer base-unit value (FR-3).");
      return;
    }

    if (!recipientAddress || !isValidStellarAddress(recipientAddress.trim())) {
      setError("Please enter a valid Stellar recipient address (must start with G and be 56 characters).");
      return;
    }

    if (!isMember) {
      setError("Only authorized members of this treasury can submit proposals (FR-3).");
      return;
    }

    if (!canPerformStateChange) {
      setError(walletActionBlockReason || "Wallet action is blocked.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/treasuries/${treasury.id}/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          amount: amountUnits.toString(),
          proposerAddress: activePersona.address,
          proposerLabel: `${activePersona.name} (${activePersona.role})`,
          recipientAddress: recipientAddress.trim().toUpperCase(),
          recipientLabel: recipientLabel.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to create proposal");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Proposal submission failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Create Spending Proposal</h2>
              <p className="text-xs text-slate-400">
                {treasury.name} · Requires {treasury.threshold} of {treasury.memberCount} approvals
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Examples */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
            <div className="text-[11px] font-semibold text-slate-400">
              Fill with sample proposal:
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setSampleRecipient(
                    "Grand Hall Convention Center Deposit",
                    "GAVENUE999HOTELCENTRALHALLTESTNETRECIPIENT1",
                    "Venue & Logistics",
                    "4500",
                    "50% downpayment for annual convention hall venue booking."
                  )
                }
                className="rounded-lg bg-slate-900 border border-slate-800 hover:border-emerald-500/40 px-2 py-1 text-[11px] text-slate-300 transition"
              >
                🏢 Venue Deposit (4,500)
              </button>
              <button
                type="button"
                onClick={() =>
                  setSampleRecipient(
                    "High-Performance Cloud GPU Compute",
                    "GCLOUDGPU999CLUSTERTESTNETRECIPIENTADDRESS2",
                    "Infrastructure",
                    "3000",
                    "3-month GPU compute cluster rental for student model training."
                  )
                }
                className="rounded-lg bg-slate-900 border border-slate-800 hover:border-emerald-500/40 px-2 py-1 text-[11px] text-slate-300 transition"
              >
                ☁️ Cloud Compute (3,000)
              </button>
              <button
                type="button"
                onClick={() =>
                  setSampleRecipient(
                    "Audio-Visual Stage Equipment",
                    "GAUDIO888RENTALSSUPPLIERTESTNETRECIPIENT2",
                    "Equipment",
                    "2800",
                    "Microphones, speakers, and projectors for auditorium summit."
                  )
                }
                className="rounded-lg bg-slate-900 border border-slate-800 hover:border-emerald-500/40 px-2 py-1 text-[11px] text-slate-300 transition"
              >
                🎤 AV Equipment (2,800)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">
              Proposal Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Venue Reservation Deposit"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">
              Purpose & Details *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide context and justification for group members to review..."
              rows={2}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                Requested Amount ({treasury.tokenSymbol}) *
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="4500"
                min="1"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white font-mono tabular-nums focus:border-emerald-500 focus:outline-none"
              />
              <div className="text-[10px] text-slate-400 mt-1">
                Available treasury balance: {formatAmount(treasury.balance, treasury.tokenSymbol)}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="Venue & Logistics">Venue & Logistics</option>
                <option value="Equipment">Equipment</option>
                <option value="Honorarium">Honorarium</option>
                <option value="Infrastructure">Infrastructure</option>
                <option value="Supplies & Food">Supplies & Food</option>
                <option value="Operations">Operations</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">
              Recipient Vendor / Organization Name
            </label>
            <input
              type="text"
              value={recipientLabel}
              onChange={(e) => setRecipientLabel(e.target.value)}
              placeholder="e.g. Grand Hall Hotel & Conventions"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">
              Recipient Stellar Address (G...) *
            </label>
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder="G..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-mono tabular-nums text-slate-200 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Upon reaching threshold, the Soroban contract executes payment directly to this recipient address.
            </p>
          </div>

          {/* Proposer Automatic Signature Notice */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-slate-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>
              As proposer, your signature is automatically recorded as Approval #1 of {treasury.threshold}.
            </span>
          </div>

          {/* Actions */}
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
                  <span>Submitting to Soroban...</span>
                </>
              ) : (
                <>
                  <PlusCircle className="h-4 w-4" />
                  <span>Submit Proposal</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
