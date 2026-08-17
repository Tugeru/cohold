"use client";

import React, { useState } from "react";
import { useModalA11y } from "@/components/useModalA11y";
import { useWallet } from "@/context/WalletContext";
import { DEMO_PERSONAS } from "@/lib/demo-adapter";
import { isValidStellarAddress } from "@/lib/stellar";
import { parseNonNegativeBaseUnits } from "@/lib/money";
import {
  X,
  ShieldPlus,
  Users,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Layers,
  Percent,
} from "lucide-react";

interface MemberDraft {
  address: string;
  label: string;
  role: string;
  avatar: string;
}

interface CreateTreasuryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (treasuryId: string) => void;
}

export function CreateTreasuryModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateTreasuryModalProps) {
  const { activePersona, canPerformStateChange, walletActionBlockReason } = useWallet();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<
    "student_org" | "small_business" | "community_fund" | "project_team" | "other"
  >("student_org");
  const [tokenSymbol, setTokenSymbol] = useState("DEMO_UNITS");
  const [initialDeposit, setInitialDeposit] = useState("1000");

  // Members list
  const [members, setMembers] = useState<MemberDraft[]>([
    {
      address: activePersona.address,
      label: `${activePersona.name} (${activePersona.role})`,
      role: activePersona.role,
      avatar: activePersona.avatar,
    },
    {
      address: DEMO_PERSONAS[1].address,
      label: "Juan Dela Cruz (Treasurer)",
      role: "Treasurer",
      avatar: "👨‍💻",
    },
    {
      address: DEMO_PERSONAS[2].address,
      label: "Chloe Lim (Secretary)",
      role: "Secretary",
      avatar: "👩‍🔬",
    },
  ]);

  // Threshold
  const [threshold, setThreshold] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useModalA11y(onClose, loading, isOpen);

  if (!isOpen) return null;

  // Preset Handlers
  const applyPreset = (presetType: "student" | "business" | "community" | "capstone") => {
    if (presetType === "student") {
      setName("University Student Council Treasury");
      setDescription("Shared student council budget for campus events, logistics, and student activities.");
      setCategory("student_org");
      setMembers([
        { address: DEMO_PERSONAS[0].address, label: "Maria Santos (President)", role: "President", avatar: "👩‍💼" },
        { address: DEMO_PERSONAS[1].address, label: "Juan Dela Cruz (Treasurer)", role: "Treasurer", avatar: "👨‍💻" },
        { address: DEMO_PERSONAS[2].address, label: "Chloe Lim (Secretary)", role: "Secretary", avatar: "👩‍🔬" },
        { address: DEMO_PERSONAS[3].address, label: "Daniel Tan (Auditor)", role: "Auditor", avatar: "🧑‍⚖️" },
      ]);
      setThreshold(3);
    } else if (presetType === "business") {
      setName("Design Studio Capital Fund");
      setDescription("Operating funds for software subscriptions, contractor payouts, and hardware.");
      setCategory("small_business");
      setMembers([
        { address: DEMO_PERSONAS[4].address, label: "Alex Rivera (Lead Partner)", role: "Lead Partner", avatar: "👨‍💼" },
        { address: DEMO_PERSONAS[5].address, label: "Samira Patel (CFO Partner)", role: "CFO", avatar: "👩‍💻" },
        { address: "GAKJ9R1T3V5X7Z9B1D3F5H7J9L1N3P5R7T9V1X3Z5B7D9F1H3J5L7N9P", label: "Kenji Sato (Tech Lead)", role: "Tech Lead", avatar: "🧑‍💻" },
      ]);
      setThreshold(2);
    } else if (presetType === "community") {
      setName("Barangay Solar Project Committee");
      setDescription("Community-funded solar street lighting and neighborhood improvement budget.");
      setCategory("community_fund");
      setMembers([
        { address: DEMO_PERSONAS[0].address, label: "Maria Santos", role: "Chair", avatar: "👩‍💼" },
        { address: DEMO_PERSONAS[1].address, label: "Juan Dela Cruz", role: "Treasurer", avatar: "👨‍💻" },
        { address: DEMO_PERSONAS[2].address, label: "Chloe Lim", role: "Secretary", avatar: "👩‍🔬" },
        { address: DEMO_PERSONAS[3].address, label: "Daniel Tan", role: "Auditor", avatar: "🧑‍⚖️" },
        { address: DEMO_PERSONAS[4].address, label: "Alex Rivera", role: "Resident Rep", avatar: "👨‍💼" },
      ]);
      setThreshold(4);
    } else if (presetType === "capstone") {
      setName("Team Alpha Capstone Budget");
      setDescription("Server hosting, domain registration, and API keys for AI research capstone.");
      setCategory("project_team");
      setMembers([
        { address: DEMO_PERSONAS[0].address, label: "Maria Santos", role: "Team Lead", avatar: "👩‍💼" },
        { address: DEMO_PERSONAS[1].address, label: "Juan Dela Cruz", role: "Backend Dev", avatar: "👨‍💻" },
        { address: DEMO_PERSONAS[2].address, label: "Chloe Lim", role: "Frontend Dev", avatar: "👩‍🔬" },
      ]);
      setThreshold(2);
    }
  };

  const addMember = () => {
    // Pick an unused persona if available, or empty
    const usedAddrs = new Set(members.map((m) => m.address.toUpperCase()));
    const unused = DEMO_PERSONAS.find((p) => !usedAddrs.has(p.address.toUpperCase()));

    if (unused) {
      setMembers([
        ...members,
        {
          address: unused.address,
          label: `${unused.name} (${unused.role})`,
          role: unused.role,
          avatar: unused.avatar,
        },
      ]);
    } else {
      setMembers([
        ...members,
        {
          address: "",
          label: `Member ${members.length + 1}`,
          role: "Member",
          avatar: "👤",
        },
      ]);
    }
  };

  const removeMember = (index: number) => {
    if (members.length <= 1) {
      setError("A treasury must have at least 1 member.");
      return;
    }
    const updated = members.filter((_, idx) => idx !== index);
    setMembers(updated);
    if (threshold > updated.length) {
      setThreshold(updated.length);
    }
  };

  const updateMember = (index: number, field: keyof MemberDraft, value: string) => {
    const updated = [...members];
    updated[index] = { ...updated[index], [field]: value };
    setMembers(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError("Please enter a treasury name.");
      setStep(1);
      return;
    }

    if (members.length === 0) {
      setError("Treasury must have at least 1 member.");
      setStep(2);
      return;
    }

    // Check addresses
    const addrSet = new Set<string>();
    for (let i = 0; i < members.length; i++) {
      const addr = members[i].address.trim().toUpperCase();
      if (!isValidStellarAddress(addr)) {
        setError(`Member #${i + 1} has an invalid Stellar address (must start with G and be 56 chars).`);
        setStep(2);
        return;
      }
      if (addrSet.has(addr)) {
        setError(`Duplicate member address detected for Member #${i + 1} (${addr.slice(0, 8)}...).`);
        setStep(2);
        return;
      }
      addrSet.add(addr);
    }

    // Ensure creator is in members
    const creatorUpper = activePersona.address.toUpperCase();
    if (!addrSet.has(creatorUpper)) {
      setError("The current creator/connected signer must be included in the member list.");
      setStep(2);
      return;
    }

    if (threshold <= 0 || threshold > members.length) {
      setError(`Threshold must be between 1 and ${members.length}.`);
      setStep(3);
      return;
    }

    let initialDepositUnits: bigint;
    try {
      initialDepositUnits = parseNonNegativeBaseUnits(initialDeposit);
    } catch {
      setError("Initial deposit must be a non-negative integer base-unit amount.");
      setStep(1);
      return;
    }

    if (!canPerformStateChange) {
      setError(walletActionBlockReason || "Wallet action is blocked.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/treasuries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          category,
          creatorAddress: activePersona.address,
          creatorLabel: `${activePersona.name} (${activePersona.role})`,
          tokenSymbol,
          threshold,
          members,
          initialDeposit: initialDepositUnits.toString(),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to create treasury");
      }

      onSuccess(data.treasuryId);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Creation failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const quorumPercent = Math.round((threshold / members.length) * 100);

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Create shared treasury" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
              <ShieldPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Create Shared Treasury</h2>
              <p className="text-xs text-slate-400">
                Create a deterministic demo treasury with immutable multi-approval rules
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

        {/* Wizard Steps indicator */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-3 bg-slate-950/50 text-xs">
          <button
            onClick={() => setStep(1)}
            className={`flex items-center gap-1.5 font-medium transition ${
              step === 1 ? "text-emerald-400 font-bold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px]">
              1
            </span>
            <span>Details & Purpose</span>
          </button>

          <span className="text-slate-600">→</span>

          <button
            onClick={() => setStep(2)}
            className={`flex items-center gap-1.5 font-medium transition ${
              step === 2 ? "text-emerald-400 font-bold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px]">
              2
            </span>
            <span>Members ({members.length})</span>
          </button>

          <span className="text-slate-600">→</span>

          <button
            onClick={() => setStep(3)}
            className={`flex items-center gap-1.5 font-medium transition ${
              step === 3 ? "text-emerald-400 font-bold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px]">
              3
            </span>
            <span>Approval Rule & Review</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Presets Banner */}
          {step === 1 && (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>Quick Start Template Presets</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset("student")}
                  className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-left hover:border-emerald-500/40 hover:bg-slate-850 transition"
                >
                  <div className="text-xs font-bold text-white">Student Org</div>
                  <div className="text-[10px] text-slate-400">4 members · 3 of 4</div>
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("business")}
                  className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-left hover:border-emerald-500/40 hover:bg-slate-850 transition"
                >
                  <div className="text-xs font-bold text-white">Small Business</div>
                  <div className="text-[10px] text-slate-400">3 partners · 2 of 3</div>
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("community")}
                  className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-left hover:border-emerald-500/40 hover:bg-slate-850 transition"
                >
                  <div className="text-xs font-bold text-white">Community Fund</div>
                  <div className="text-[10px] text-slate-400">5 members · 4 of 5</div>
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("capstone")}
                  className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-left hover:border-emerald-500/40 hover:bg-slate-850 transition"
                >
                  <div className="text-xs font-bold text-white">Project Team</div>
                  <div className="text-[10px] text-slate-400">3 members · 2 of 3</div>
                </button>
              </div>
            </div>
          )}

          {/* STEP 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Treasury Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. IT Society Event Fund"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Description / Purpose
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the shared goal or purpose for these funds..."
                  rows={2}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as "student_org" | "small_business" | "community_fund" | "project_team" | "other")
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="student_org">Student Organization</option>
                    <option value="small_business">Small Business / Partnership</option>
                    <option value="community_fund">Community Fund</option>
                    <option value="project_team">Project Team / Capstone</option>
                    <option value="other">General / Barkada Trip</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">
                    Asset / Unit Symbol
                  </label>
                  <input
                    type="text"
                    value={tokenSymbol}
                    onChange={(e) => setTokenSymbol(e.target.value)}
                    placeholder="DEMO_UNITS or XLM"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white font-mono tabular-nums uppercase focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Initial Seed Contribution ({tokenSymbol})
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={initialDeposit}
                  onChange={(e) => setInitialDeposit(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white font-mono tabular-nums focus:border-emerald-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Seed demo units are recorded in fixture state only; no Testnet balance changes.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: Members List */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-slate-200">
                    Authorized Signers ({members.length} Members)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Members have equal voting weight. Membership becomes immutable on creation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addMember}
                  className="flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Signer</span>
                </button>
              </div>

              <div className="space-y-3">
                {members.map((m, idx) => {
                  const isCreator = m.address.toUpperCase() === activePersona.address.toUpperCase();
                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{m.avatar || "👤"}</span>
                          <input
                            type="text"
                            value={m.label}
                            onChange={(e) => updateMember(idx, "label", e.target.value)}
                            placeholder={`Member ${idx + 1} Name`}
                            className="bg-transparent text-xs font-bold text-white border-b border-transparent hover:border-slate-700 focus:border-emerald-500 focus:outline-none"
                          />
                          {isCreator && (
                            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                              Creator (You)
                            </span>
                          )}
                        </div>

                        {members.length > 1 && !isCreator && (
                          <button
                            type="button"
                            onClick={() => removeMember(idx)}
                            className="text-slate-500 hover:text-rose-400 transition"
                            title="Remove Member"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      <div>
                        <input
                          type="text"
                          value={m.address}
                          onChange={(e) => updateMember(idx, "address", e.target.value)}
                          placeholder="Stellar Public Key (G... 56 characters)"
                          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-300 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Approval Threshold & Final Confirmation */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-200">
                      Approval Threshold
                    </div>
                    <div className="text-xs text-slate-400">
                      How many signers are required to authorize any expense?
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
                      {threshold} of {members.length}
                    </span>
                    <div className="text-[11px] text-slate-400 font-medium">
                      ({quorumPercent}% consensus)
                    </div>
                  </div>
                </div>

                <input
                  type="range"
                  min={1}
                  max={members.length}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />

                <div className="flex justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                  <span>1 (Any single member)</span>
                  <span>{Math.ceil(members.length / 2)} (Majority)</span>
                  <span>{members.length} (Unanimous)</span>
                </div>
              </div>

              {/* Summary Card */}
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2 text-xs">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Demo Treasury Summary</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-300 pt-1">
                  <div>
                    Name: <span className="text-white font-semibold">{name || "Untitled"}</span>
                  </div>
                  <div>
                    Quorum Rule: <span className="text-emerald-400 font-semibold">{threshold} of {members.length} Required</span>
                  </div>
                  <div>
                    Total Members: <span className="text-white font-semibold">{members.length} Signers</span>
                  </div>
                  <div>
                    Initial Balance: <span className="text-emerald-400 font-semibold font-mono tabular-nums">{initialDeposit} {tokenSymbol}</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 pt-2 border-t border-emerald-500/20">
                  Demo fixture membership and approval threshold are immutable for this walkthrough; no Stellar Testnet state changes.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4 bg-slate-950">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 1 && !name.trim()) {
                    setError("Please enter a treasury name.");
                    return;
                  }
                  setError(null);
                  setStep((s) => (s + 1) as 1 | 2 | 3);
                }}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition shadow-md shadow-emerald-600/30"
              >
                Next Step →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2 text-xs font-bold text-white hover:from-emerald-500 hover:to-teal-500 transition shadow-lg shadow-emerald-600/30"
              >
                {loading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Creating demo treasury...</span>
                  </>
                ) : (
                  <>
                    <ShieldPlus className="h-4 w-4" />
                    <span>Create Demo Treasury</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
