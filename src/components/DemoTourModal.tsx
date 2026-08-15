"use client";

import React, { useState } from "react";
import confetti from "canvas-confetti";
import {
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
  Building,
  UserCheck,
  X,
  Lock,
  Zap,
  ExternalLink,
} from "lucide-react";
import { formatAddress, generateStellarTxHash } from "@/lib/utils";

interface DemoTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData?: () => void;
}

export function DemoTourModal({
  isOpen,
  onClose,
  onRefreshData,
}: DemoTourModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [balance, setBalance] = useState(10000);
  const [approvals, setApprovals] = useState<string[]>([
    "GB2YQK3XW5U7M9N1P3R5T7V9X1Z3B5D7F9H1J3L5N7P9R1T3V5X7Z9B1", // Juan
  ]);
  const [status, setStatus] = useState<"pending" | "approved" | "executed">("pending");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetDemo = () => {
    setCurrentStep(0);
    setBalance(10000);
    setApprovals(["GB2YQK3XW5U7M9N1P3R5T7V9X1Z3B5D7F9H1J3L5N7P9R1T3V5X7Z9B1"]);
    setStatus("pending");
    setErrorMessage(null);
    setSuccessMessage(null);
    setTxHash(null);
  };

  const steps = [
    {
      title: "1. Treasury & Proposal Setup",
      persona: "Juan Dela Cruz (Treasurer)",
      description:
        "The IT Society Event Fund has 4 members and a 3-of-4 approval rule (75% threshold). A proposal for 'Venue Deposit (4,500 demo units)' has been submitted.",
      actionText: "Maria Santos (President) Approves",
      action: () => {
        setApprovals((prev) => [
          ...prev,
          "GD7VXZK2PZ4O4NKL66S5YEM53H7M2T4YV77LQO7JEQN2J3QZ5XG6P4RD",
        ]);
        setSuccessMessage("Maria Santos (President) signed approval! (2 / 3 required)");
        setErrorMessage(null);
        setCurrentStep(1);
      },
    },
    {
      title: "2. Verify Threshold Precondition (Attempt Premature Execution)",
      persona: "Any Officer",
      description:
        "We now have 2 approvals (Juan and Maria). But the rule mandates 3 approvals. Let's attempt to execute payment now to prove Soroban smart contract protection.",
      actionText: "⚡ Attempt Premature Execution (Test Invariant 3)",
      action: () => {
        setErrorMessage(
          "⛔ SOROBAN CONTRACT REJECTION: ThresholdNotReached (Invariant 3). Required: 3 approvals, Received: 2. Funds remain 100% locked."
        );
        setSuccessMessage(null);
        setCurrentStep(2);
      },
    },
    {
      title: "3. Chloe Lim (Secretary) Casts Decisive 3rd Approval",
      persona: "Chloe Lim (Secretary)",
      description:
        "The contract correctly refused payout! Now Chloe reviews and approves the proposal. The 3-of-4 quorum is met.",
      actionText: "Chloe Lim Signs 3rd Approval",
      action: () => {
        setApprovals((prev) => [
          ...prev,
          "GC4X9K1M3P5R7T9V1X3Z5B7D9F1H3J5L7N9P1R3T5V7X9Z1B3D5F7H9J",
        ]);
        setStatus("approved");
        setSuccessMessage(
          "✅ Quorum reached! Proposal state transitioned from 'Pending' to 'Approved' (3 / 3 required)."
        );
        setErrorMessage(null);
        setCurrentStep(3);
      },
    },
    {
      title: "4. Execute Payment to Grand Hall Venue",
      persona: "Contract Execution",
      description:
        "With 3 of 4 approvals recorded on Soroban, the payment is fully authorized. Let's trigger execution to transfer 4,500 units to the Venue recipient.",
      actionText: "🚀 Execute Authorized Payment",
      action: () => {
        const hash = generateStellarTxHash();
        setBalance(5500);
        setStatus("executed");
        setTxHash(hash);
        setSuccessMessage(
          "🎉 PAYMENT EXECUTED! 4,500 units transferred to Venue Supplier. Remaining treasury balance: 5,500 units."
        );
        setErrorMessage(null);
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        setCurrentStep(4);
      },
    },
    {
      title: "5. Test Double-Execution Attack Prevention",
      persona: "Malicious / Repeated Caller",
      description:
        "Payment has completed. What happens if someone tries to execute the same approved proposal again? Soroban Invariant 5 must strictly block double payout.",
      actionText: "⚡ Attempt Double Execution (Test Invariant 5)",
      action: () => {
        setErrorMessage(
          "⛔ SOROBAN CONTRACT REJECTION: AlreadyExecuted (Invariant 5). Proposal has already been finalized. Double-spend prevented."
        );
        setSuccessMessage(null);
        setCurrentStep(5);
      },
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                PRD Section 26 Demo Walkthrough
              </h2>
              <p className="text-xs text-slate-400">
                Live simulation of Soroban multi-signature governance invariants
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
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Treasury State Card */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎓</span>
                <div>
                  <div className="text-sm font-semibold text-white">
                    IT Society Event Fund
                  </div>
                  <div className="text-xs text-slate-400">
                    Rule: <span className="text-emerald-400 font-semibold">3 of 4</span> approvals required
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Treasury Balance</div>
                <div className="text-lg font-bold font-mono text-emerald-400">
                  {balance.toLocaleString()} DEMO_UNITS
                </div>
              </div>
            </div>

            {/* Proposal Details */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">
                  Proposal: Venue Deposit
                </span>
                <span className="font-mono font-bold text-amber-400">
                  4,500 DEMO_UNITS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Destination: Recipient Grand Hall Convention Center
              </p>

              {/* Progress */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Approvals:</span>
                  <span className="font-mono font-bold text-slate-200">
                    {approvals.length} / 3 Required
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      status === "executed"
                        ? "bg-slate-400"
                        : approvals.length >= 3
                        ? "bg-emerald-500"
                        : "bg-amber-500"
                    }`}
                    style={{
                      width: `${Math.min((approvals.length / 3) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Signers Ledger */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px]">
                <div
                  className={`p-2 rounded border text-center ${
                    approvals.includes("GB2YQK3XW5U7M9N1P3R5T7V9X1Z3B5D7F9H1J3L5N7P9R1T3V5X7Z9B1")
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-slate-800 bg-slate-950 text-slate-400"
                  }`}
                >
                  <div className="font-semibold">Juan (Treasurer)</div>
                  <div>
                    {approvals.includes("GB2YQK3XW5U7M9N1P3R5T7V9X1Z3B5D7F9H1J3L5N7P9R1T3V5X7Z9B1")
                      ? "✓ Approved"
                      : "⏳ Pending"}
                  </div>
                </div>

                <div
                  className={`p-2 rounded border text-center ${
                    approvals.includes("GD7VXZK2PZ4O4NKL66S5YEM53H7M2T4YV77LQO7JEQN2J3QZ5XG6P4RD")
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-slate-800 bg-slate-950 text-slate-400"
                  }`}
                >
                  <div className="font-semibold">Maria (President)</div>
                  <div>
                    {approvals.includes("GD7VXZK2PZ4O4NKL66S5YEM53H7M2T4YV77LQO7JEQN2J3QZ5XG6P4RD")
                      ? "✓ Approved"
                      : "⏳ Pending"}
                  </div>
                </div>

                <div
                  className={`p-2 rounded border text-center ${
                    approvals.includes("GC4X9K1M3P5R7T9V1X3Z5B7D9F1H3J5L7N9P1R3T5V7X9Z1B3D5F7H9J")
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-slate-800 bg-slate-950 text-slate-400"
                  }`}
                >
                  <div className="font-semibold">Chloe (Secretary)</div>
                  <div>
                    {approvals.includes("GC4X9K1M3P5R7T9V1X3Z5B7D9F1H3J5L7N9P1R3T5V7X9Z1B3D5F7H9J")
                      ? "✓ Approved"
                      : "⏳ Pending"}
                  </div>
                </div>

                <div
                  className={`p-2 rounded border text-center ${
                    approvals.includes("GA9P1R3T5V7X9Z1B3D5F7H9J1L3N5P7R9T1V3X5Z7B9D1F3H5J7L9N1P")
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-slate-800 bg-slate-950 text-slate-400"
                  }`}
                >
                  <div className="font-semibold">Daniel (Auditor)</div>
                  <div>
                    {approvals.includes("GA9P1R3T5V7X9Z1B3D5F7H9J1L3N5P7R9T1V3X5Z7B9D1F3H5J7L9N1P")
                      ? "✓ Approved"
                      : "⏳ Pending"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feedback message boxes */}
          {errorMessage && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-300 flex items-start gap-2.5 animate-in fade-in">
              <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-rose-200">
                  Soroban Financial Invariant Check:
                </div>
                <div className="mt-1">{errorMessage}</div>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs text-emerald-300 flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-emerald-200">
                  State Update Confirmed:
                </div>
                <div className="mt-1">{successMessage}</div>
                {txHash && (
                  <div className="mt-2 font-mono text-[10px] text-slate-400">
                    Tx Hash: {txHash}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Current Step Instruction */}
          {currentStep < steps.length ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Step {currentStep + 1} of {steps.length}
                </span>
                <span className="text-xs font-medium text-slate-400">
                  Actor: {steps[currentStep].persona}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-white">
                {steps[currentStep].title}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {steps[currentStep].description}
              </p>
              <button
                onClick={steps[currentStep].action}
                className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:from-emerald-500 hover:to-teal-500 transition"
              >
                <span>{steps[currentStep].actionText}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-white">
                Section 26 Demo Complete!
              </h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                You observed the full Cohold lifecycle: multi-approval governance,
                rejection of premature execution, threshold transition, secure
                token disbursement, and prevention of double-spend attempts.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={resetDemo}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Restart Demo</span>
                </button>
                <button
                  onClick={onClose}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
