"use client";

import React, { useState } from "react";
import { Treasury } from "@/types";
import { useWallet } from "@/context/WalletContext";
import { formatAddress, formatDate } from "@/lib/utils";
import { getStellarExpertUrl } from "@/lib/stellar";
import {
  Users,
  ShieldCheck,
  Lock,
  Copy,
  Check,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Crown,
} from "lucide-react";

interface MembersTabProps {
  treasury: Treasury;
}

export function MembersTab({ treasury }: MembersTabProps) {
  const { activePersona, setActivePersona, personas } = useWallet();
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  const members = treasury.members || [];
  const creatorAddress = treasury.creatorAddress.toUpperCase();

  const copy = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Governance Invariants Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">
              Immutable Governance Rule: {treasury.threshold} of {treasury.memberCount} Signatures
            </h3>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            {Math.round((treasury.threshold / treasury.memberCount) * 100)}% Quorum Required
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          In Cohold, membership and approval thresholds become permanently immutable on-chain once the treasury is initialized. Every member possesses equal 1-member-1-vote authority, and the creator retains no backdoor permissions.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <div className="text-[11px] text-slate-400 font-medium">Total Member Roster</div>
            <div className="text-lg font-bold font-mono text-white mt-0.5">
              {treasury.memberCount} Members
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <div className="text-[11px] text-slate-400 font-medium">Quorum Required</div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
              {treasury.threshold} Approvals
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <div className="text-[11px] text-slate-400 font-medium">Unilateral Outflows Allowed</div>
            <div className="text-lg font-bold font-mono text-rose-400 mt-0.5">
              0 (Strictly Blocked)
            </div>
          </div>
        </div>
      </div>

      {/* Member Roster List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Authorized Signers ({members.length})
          </h3>
          <span className="text-xs text-slate-400">
            Click &quot;Switch to Signer&quot; to test approval voting
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {members.map((m, idx) => {
            const isCreator = m.address.toUpperCase() === creatorAddress;
            const isCurrentActive = m.address.toUpperCase() === activePersona.address.toUpperCase();
            const matchingPersona = personas.find(
              (p) => p.address.toUpperCase() === m.address.toUpperCase()
            );

            return (
              <div
                key={m.id}
                className={`rounded-2xl border p-4 transition ${
                  isCurrentActive
                    ? "border-emerald-500/50 bg-emerald-950/20 shadow-md shadow-emerald-500/5"
                    : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-2xl">
                      {m.avatar || "👤"}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-white">
                          {m.label || `Member #${idx + 1}`}
                        </span>
                        {isCreator && (
                          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20 flex items-center gap-0.5">
                            <Crown className="h-3 w-3" />
                            Creator
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        {m.role || "Member"}
                      </div>
                    </div>
                  </div>

                  {isCurrentActive ? (
                    <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-400 border border-emerald-500/30">
                      Active Signer
                    </span>
                  ) : matchingPersona ? (
                    <button
                      onClick={() => setActivePersona(matchingPersona)}
                      className="rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:text-white transition"
                    >
                      Switch to Signer
                    </button>
                  ) : null}
                </div>

                {/* Address bar */}
                <div className="mt-3 rounded-lg bg-slate-950 px-3 py-2 flex items-center justify-between text-xs text-slate-300 font-mono">
                  <span>{formatAddress(m.address, 8)}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copy(m.address)}
                      className="text-slate-400 hover:text-white transition"
                      title="Copy full address"
                    >
                      {copiedAddr === m.address ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <a
                      href={getStellarExpertUrl("account", m.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 transition"
                      title="View on Stellar Expert"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
