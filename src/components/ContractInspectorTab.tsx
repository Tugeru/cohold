"use client";

import React, { useState } from "react";
import { Treasury } from "@/types";
import { CONTRACT_SECURITY_INVARIANTS } from "@/lib/contract-invariants";
import { useContractSource } from "@/lib/contract-source";
import { formatAddress, formatAmount } from "@/lib/utils";
import { getStellarExpertUrl } from "@/lib/stellar";
import {
  Code2,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Database,
  Layers,
  Terminal,
  FileCode,
} from "lucide-react";

interface ContractInspectorTabProps {
  treasury: Treasury;
}

export function ContractInspectorTab({ treasury }: ContractInspectorTabProps) {
  const [copied, setCopied] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"state" | "rust" | "storage">("state");
  const { source: rustSource, error: rustError, retry: retryRustSource } =
    useContractSource(activeSubTab === "rust");

  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const members = treasury.members || [];
  const proposals = treasury.proposals || [];

  return (
    <div className="space-y-6">
      {/* Contract Header */}
      <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400">
              <Code2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  Soroban Smart Contract
                </h3>
                <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-500/30">
                  Stellar Testnet
                </span>
              </div>
              <div className="font-mono tabular-nums text-xs text-slate-300 mt-0.5 flex items-center gap-2">
                <span>{treasury.contractAddress}</span>
                <button
                  onClick={() => copy(treasury.contractAddress)}
                  className="text-slate-400 hover:text-white"
                  title="Copy contract address"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
                <a
                  href={getStellarExpertUrl("contract", treasury.contractAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveSubTab("state")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            activeSubTab === "state"
              ? "bg-slate-800 text-white"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Database className="h-3.5 w-3.5 text-emerald-400" />
          <span>Live Contract State</span>
        </button>

        <button
          onClick={() => setActiveSubTab("rust")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            activeSubTab === "rust"
              ? "bg-slate-800 text-white"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileCode className="h-3.5 w-3.5 text-cyan-400" />
          <span>Rust Source (lib.rs)</span>
        </button>

        <button
          onClick={() => setActiveSubTab("storage")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            activeSubTab === "storage"
              ? "bg-slate-800 text-white"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Layers className="h-3.5 w-3.5 text-purple-400" />
          <span>Storage Key Mapping</span>
        </button>
      </div>

      {/* 1. Live State */}
      {activeSubTab === "state" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <div className="text-xs text-slate-400 font-medium">Contract Balance</div>
              <div className="text-xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
                {formatAmount(treasury.balance, treasury.tokenSymbol)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">DataKey::ContractBalance</div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <div className="text-xs text-slate-400 font-medium">Threshold Quorum</div>
              <div className="text-xl font-bold font-mono tabular-nums text-amber-400 mt-1">
                {treasury.threshold} / {treasury.memberCount}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">TreasuryConfig.threshold</div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <div className="text-xs text-slate-400 font-medium">Proposals Created</div>
              <div className="text-xl font-bold font-mono tabular-nums text-cyan-400 mt-1">
                {proposals.length} Total
              </div>
              <div className="text-[10px] text-slate-500 mt-1">DataKey::ProposalCount</div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <div className="text-xs text-slate-400 font-medium">Network Passphrase</div>
              <div className="text-xs font-mono tabular-nums text-slate-200 mt-1 truncate">
                Test SDF Network ; Sep 2015
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Stellar Testnet RPC</div>
            </div>
          </div>

          {/* Invariant Checklist */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Enforced Soroban Security Invariants
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {CONTRACT_SECURITY_INVARIANTS.map((inv) => (
                <div
                  key={inv.id}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono tabular-nums font-bold text-emerald-400">
                      {inv.id}: {inv.name}
                    </span>
                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/20">
                      ✓ Active
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    {inv.rule}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. Rust Source */}
      {activeSubTab === "rust" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              contracts/cohold/src/lib.rs (Soroban SDK 27)
            </span>
            {rustSource && (
              <button
                onClick={() => copy(rustSource)}
                className="flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs text-slate-200 transition"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span>{copied ? "Copied" : "Copy Rust Code"}</span>
              </button>
            )}
          </div>
          {rustSource ? (
            <pre className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs font-mono tabular-nums text-cyan-200 overflow-x-auto leading-relaxed max-h-[600px]">
              {rustSource}
            </pre>
          ) : rustError ? (
            <div className="rounded-2xl border border-red-900/50 bg-red-950/30 p-4 text-xs text-red-300 space-y-2">
              <p>Could not load contract source: {rustError}</p>
              <button
                onClick={retryRustSource}
                className="rounded bg-red-900/50 hover:bg-red-900/70 px-2.5 py-1 text-[11px] text-red-200 transition"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-400">
              Loading contracts/cohold/src/lib.rs…
            </div>
          )}
        </div>
      )}

      {/* 3. Storage Layout */}
      {activeSubTab === "storage" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
            Soroban Persistent & Instance Storage Layout
          </h4>
          <div className="space-y-3 text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-1">
              <div className="font-mono tabular-nums font-bold text-cyan-400">DataKey::Config</div>
              <p className="text-slate-400 text-[11px]">
                Stores <code className="text-slate-200">TreasuryConfig</code> (creator, token address, threshold = {treasury.threshold}, member_count = {treasury.memberCount}, name = &quot;{treasury.name}&quot;).
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-1">
              <div className="font-mono tabular-nums font-bold text-cyan-400">DataKey::Member(Address) -&gt; bool</div>
              <p className="text-slate-400 text-[11px]">
                Maps each member Stellar address to boolean true. Verified via <code className="text-slate-200">is_member()</code> and <code className="text-slate-200">require_auth()</code>.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-1">
              <div className="font-mono tabular-nums font-bold text-cyan-400">DataKey::Approval(proposal_id, member_address) -&gt; bool</div>
              <p className="text-slate-400 text-[11px]">
                Prevents duplicate approvals by verifying uniqueness for each proposal ID before incrementing the approval counter.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-1">
              <div className="font-mono tabular-nums font-bold text-cyan-400">DataKey::ContractBalance -&gt; i128</div>
              <p className="text-slate-400 text-[11px]">
                Maintains authoritative internal treasury token balance ({formatAmount(treasury.balance, treasury.tokenSymbol)}).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
