"use client";

import React, { useState } from "react";
import {
  RUST_SOROBAN_CONTRACT_CODE,
  CONTRACT_SECURITY_INVARIANTS,
} from "@/lib/soroban-contract";
import {
  Code2,
  Copy,
  Check,
  X,
  ShieldCheck,
  FileCode,
  Terminal,
  Layers,
} from "lucide-react";

interface ContractModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ContractModal({ isOpen, onClose }: ContractModalProps) {
  const [activeTab, setActiveTab] = useState<"rust" | "invariants" | "cli">("rust");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const CARGO_CLI_EXAMPLE = `# Deploy Cohold Soroban Contract to Stellar Testnet

# 1. Build contract Wasm
soroban contract build

# 2. Deploy Wasm to Stellar Testnet
soroban contract deploy \\
  --wasm target/wasm32-unknown-unknown/release/cohold.wasm \\
  --source <SIGNER_IDENTITY> \\
  --network testnet

# 3. Initialize Shared Treasury (e.g. 3 of 4 threshold)
soroban contract invoke \\
  --id <CONTRACT_ID> \\
  --source <CREATOR_IDENTITY> \\
  --network testnet \\
  -- \\
  initialize \\
  --creator <CREATOR_ADDRESS> \\
  --token <SAC_TESTNET_TOKEN_ADDRESS> \\
  --members '["GD7V...", "GB2Y...", "GC4X...", "GA9P..."]' \\
  --threshold 3 \\
  --name "IT Society Event Fund"
`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-4xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400">
              <Code2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Stellar Soroban Smart Contract
              </h2>
              <p className="text-xs text-slate-400">
                Rust implementation for multi-approval shared treasury governance
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

        {/* Tab Selector */}
        <div className="flex items-center gap-2 border-b border-slate-800 px-6 py-2 bg-slate-900/50">
          <button
            onClick={() => setActiveTab("rust")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "rust"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileCode className="h-3.5 w-3.5" />
            <span>src/lib.rs (Rust Source)</span>
          </button>

          <button
            onClick={() => setActiveTab("invariants")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "invariants"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Security Invariants ({CONTRACT_SECURITY_INVARIANTS.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("cli")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "cli"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>CLI Deployment Guide</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {activeTab === "rust" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono tabular-nums">
                  cohold-contract/src/lib.rs (Soroban SDK v21+)
                </span>
                <button
                  onClick={() => copyCode(RUST_SOROBAN_CONTRACT_CODE)}
                  className="flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs text-slate-200 transition"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>{copied ? "Copied" : "Copy Rust Code"}</span>
                </button>
              </div>
              <pre className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs font-mono tabular-nums text-cyan-200 overflow-x-auto leading-relaxed">
                {RUST_SOROBAN_CONTRACT_CODE}
              </pre>
            </div>
          )}

          {activeTab === "invariants" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                The Cohold Soroban smart contract implements strict formal
                invariants preventing unauthorized spending, double-spending,
                and unilateral custody.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {CONTRACT_SECURITY_INVARIANTS.map((inv) => (
                  <div
                    key={inv.id}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono tabular-nums text-xs font-bold text-emerald-400">
                        {inv.id}
                      </span>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                        {inv.status}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-white">
                      {inv.name}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {inv.rule}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "cli" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Stellar CLI commands for compiling & invoking on Testnet
                </span>
                <button
                  onClick={() => copyCode(CARGO_CLI_EXAMPLE)}
                  className="flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs text-slate-200 transition"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>{copied ? "Copied" : "Copy Commands"}</span>
                </button>
              </div>
              <pre className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs font-mono tabular-nums text-purple-200 overflow-x-auto leading-relaxed">
                {CARGO_CLI_EXAMPLE}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
