"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useModalA11y } from "@/components/useModalA11y";
import { coholdConfig, configuredRpcUrl } from "@/lib/cohold-config";
import {
  createTreasuryDeployFlow,
  normalizeTreasuryDetails,
  stellarTreasuryDeployExecutor,
  validateTreasuryDetails,
  type TreasuryDeployFlow,
  type TreasuryDeployOutcome,
  type TreasuryDeployStageName,
  type TreasuryTxState,
} from "@/lib/treasury-deploy";
import { isValidContractAddress } from "@/lib/stellar";
import { registerTreasury } from "@/lib/treasury-registry";
import { APP_ROUTES } from "@/lib/app-routes";
import { useWallet } from "@/context/WalletContext";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Loader2,
  Plus,
  PlusCircle,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

const STAGE_ORDER: TreasuryDeployStageName[] = ["create"];

const STAGE_LABELS: Record<TreasuryDeployStageName, string> = {
  create: "Create your treasury on-chain",
};

const TX_STATE_LABELS: Record<TreasuryTxState, string> = {
  preparing: "Checking the network…",
  "awaiting-signature": "Waiting for your approval in Freighter…",
  submitting: "Submitting to Stellar Testnet…",
  confirming: "Confirming on the network…",
};

type DialogStage =
  | { kind: "form" }
  | { kind: "deploying"; stageIndex: number; txState: TreasuryTxState }
  | { kind: "failed"; outcome: TreasuryDeployOutcome }
  | { kind: "success"; contractId: string };

let cachedWasm: Promise<Uint8Array> | null = null;

function fetchCoholdWasm(): Promise<Uint8Array> {
  cachedWasm ??= (async () => {
    const response = await fetch("/cohold.wasm");
    if (!response.ok) {
      throw new Error(`contract code returned HTTP ${response.status}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  })();
  return cachedWasm;
}

function outcomeMessage(outcome: TreasuryDeployOutcome): string {
  switch (outcome.status) {
    case "wasm-unavailable":
      return "The app's contract code couldn't be loaded. Reload the page and try again.";
    case "simulation-failed":
      return `Testnet rejected the ${STAGE_LABELS[outcome.stage].toLowerCase()}. ${outcome.message}`;
    case "sign-failed":
      switch (outcome.error.kind) {
        case "wallet-rejected":
          return "You cancelled the signature — nothing was created.";
        case "wallet-network":
          return "Switch Freighter to Stellar Testnet and try again.";
        case "wallet-unavailable":
          return "Connect Freighter and try again.";
        default:
          return "The transaction could not be signed — nothing was created.";
      }
    case "send-failed":
      return `Testnet rejected the transaction — nothing was created. Your wallet needs Testnet XLM to cover deployment fees.`;
    case "confirm-failed":
      return outcome.message;
    default:
      return "The treasury could not be created.";
  }
}

/**
 * Wallet-mode "Create Treasury" dialog. Creates a real Cohold treasury
 * instance on Stellar Testnet from the connected Freighter wallet with one
 * signed transaction: the CoholdFactory contract deploys a fresh Cohold
 * instance and initializes members/threshold/name in a single call, simulated
 * before signing. On success the new contract id is registered locally so the
 * overview and treasury list pick it up immediately — no env edit, no
 * restart — and the factory's on-chain treasury list makes it discoverable
 * on any other device for the same wallet or its co-members.
 */
export function WalletCreateTreasuryDialog({
  onClose,
}: {
  onClose: (createdTreasuryId: string | null) => void;
}) {
  const dialogRef = useModalA11y(() => {
    if (stage.kind !== "deploying") onClose(null);
  });
  const router = useRouter();
  const { freighterAddress, signTransaction } = useWallet();
  const creatorAddress = freighterAddress?.toUpperCase() ?? null;

  const factoryMisconfigured =
    !coholdConfig.factoryId || !isValidContractAddress(coholdConfig.factoryId);
  const factoryConfigError = factoryMisconfigured
    ? "The treasury factory is not configured on this deployment (NEXT_PUBLIC_COHOLD_FACTORY_ID)."
    : null;

  const flow: TreasuryDeployFlow | null = useMemo(() => {
    if (factoryMisconfigured) return null;
    try {
      return createTreasuryDeployFlow({
        executor: stellarTreasuryDeployExecutor({
          rpcUrl: configuredRpcUrl(coholdConfig),
          factoryId: coholdConfig.factoryId,
        }),
        fetchWasm: fetchCoholdWasm,
        signTransaction,
        registerTreasury,
      });
    } catch {
      return null;
    }
  }, [signTransaction, factoryMisconfigured]);

  const [stage, setStage] = useState<DialogStage>({ kind: "form" });
  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>(
    creatorAddress ? [creatorAddress] : [],
  );
  const [threshold, setThreshold] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const details = useMemo(
    () => normalizeTreasuryDetails({ name, members, threshold }),
    [name, members, threshold],
  );

  const setMemberAt = useCallback((index: number, value: string) => {
    setMembers((current) =>
      current.map((member, i) => (i === index ? value : member)),
    );
  }, []);

  const removeMemberAt = useCallback((index: number) => {
    setMembers((current) => current.filter((_, i) => i !== index));
  }, []);

  const addMember = useCallback(() => {
    setMembers((current) => [...current, ""]);
  }, []);

  const clampThreshold = useCallback((value: number) => {
    const memberCount = members.length;
    setThreshold(Math.min(Math.max(1, Math.floor(value)), memberCount));
  }, [members.length]);

  const deploy = useCallback(async () => {
    if (busyRef.current) return;
    if (factoryConfigError) {
      setFormError(factoryConfigError);
      return;
    }
    if (!flow) {
      setFormError(
        "The treasury factory is not configured on this deployment (NEXT_PUBLIC_COHOLD_FACTORY_ID).",
      );
      return;
    }
    const validation = validateTreasuryDetails(details, creatorAddress);
    if (validation) {
      setFormError(validation);
      return;
    }
    if (!creatorAddress || !coholdConfig.tokenId) return;

    busyRef.current = true;
    setFormError(null);
    setStage({ kind: "deploying", stageIndex: 0, txState: "preparing" });

    const outcome = await flow.deploy(
      details,
      creatorAddress,
      coholdConfig.tokenId,
      (stageName, txState) => {
        setStage({
          kind: "deploying",
          stageIndex: STAGE_ORDER.indexOf(stageName),
          txState,
        });
      },
    );
    busyRef.current = false;

    if (outcome.status === "deployed") {
      setStage({ kind: "success", contractId: outcome.contractId });
    } else {
      setStage({ kind: "failed", outcome });
    }
  }, [details, creatorAddress, flow, factoryConfigError]);

  const openTreasury = useCallback(
    (contractId: string) => {
      onClose(contractId);
      router.push(APP_ROUTES.treasury(contractId));
    },
    [onClose, router],
  );

  const copyContractId = useCallback(async (contractId: string) => {
    try {
      await navigator.clipboard.writeText(contractId);
    } catch {
      // Clipboard unavailable (permissions): the id stays visible on screen.
    }
  }, []);

  const thresholdClamped = Math.min(
    Math.max(1, Math.floor(threshold)),
    Math.max(1, members.length),
  );

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-create-treasury-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
              <PlusCircle className="h-5 w-5" />
            </span>
            <div>
              <h2 id="wallet-create-treasury-title" className="text-sm font-bold text-white">
                Create a treasury
              </h2>
              <p className="text-[11px] text-slate-400">
                Deployed on Stellar Testnet from your wallet
              </p>
            </div>
          </div>
          <button
            onClick={() => onClose(null)}
            aria-label="Close"
            disabled={stage.kind === "deploying"}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {stage.kind === "form" && (
          <>
            <div className="space-y-4 p-5">
              <div>
                <label htmlFor="treasury-name" className="mb-1.5 block text-xs font-semibold text-slate-300">
                  Treasury name
                </label>
                <input
                  id="treasury-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={60}
                  placeholder="e.g. Weekend Trip Fund"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">
                    Members <span className="font-normal text-slate-500">({members.length})</span>
                  </span>
                  <button
                    onClick={addMember}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/10"
                  >
                    <Plus className="h-3 w-3" /> Add member
                  </button>
                </div>
                <div className="space-y-2">
                  {members.map((member, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        value={member}
                        onChange={(event) => setMemberAt(index, event.target.value)}
                        placeholder="G… wallet address"
                        readOnly={index === 0}
                        aria-label={`Member ${index + 1} address`}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-xs text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none disabled:opacity-70"
                      />
                      {index === 0 ? (
                        <span
                          title="The treasury creator is always a member"
                          className="shrink-0 rounded-lg bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-300"
                        >
                          You
                        </span>
                      ) : (
                        <button
                          onClick={() => removeMemberAt(index)}
                          aria-label={`Remove member ${index + 1}`}
                          className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Anyone can propose spending. The wallet address that creates the treasury is
                  always a member.
                </p>
              </div>

              <div>
                <label htmlFor="treasury-threshold" className="mb-1.5 block text-xs font-semibold text-slate-300">
                  Approvals needed to spend
                </label>
                <input
                  id="treasury-threshold"
                  type="number"
                  min={1}
                  max={Math.max(1, members.length)}
                  value={thresholdClamped}
                  onChange={(event) => clampThreshold(Number(event.target.value))}
                  className="w-24 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                />
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {thresholdClamped} of {members.length} members must approve a proposal before
                  funds move.
                </p>
              </div>

              {formError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-400">
                <div className="mb-1 flex items-center gap-1.5 font-semibold text-slate-300">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                  What happens
                </div>
                One transaction is signed in Freighter: the factory deploys your treasury and
                sets up members and rules in the same call. Your wallet pays the fee in Testnet
                XLM — no real money is ever used.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-800 p-4">
              <button
                onClick={() => onClose(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => void deploy()}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition"
              >
                Deploy treasury
              </button>
            </div>
          </>
        )}

        {stage.kind === "deploying" && (
          <div className="space-y-4 p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white">
                  {STAGE_LABELS[STAGE_ORDER[stage.stageIndex]]}
                </div>
                <div className="text-[11px] text-emerald-300">
                  {TX_STATE_LABELS[stage.txState]}
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Keep Freighter open — you&apos;ll be asked to approve one signature. Nothing is
              created until the transaction confirms.
            </p>
          </div>
        )}

        {stage.kind === "failed" && (
          <div className="space-y-4 p-5">
            <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
              <div>
                <div className="text-xs font-bold text-white">The treasury wasn&apos;t created</div>
                <p className="mt-1 text-xs leading-relaxed text-red-200">
                  {outcomeMessage(stage.outcome)}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              No treasury appears on your overview until deployment fully completes. You can
              safely try again.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => onClose(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Close
              </button>
              <button
                onClick={() => setStage({ kind: "form" })}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {stage.kind === "success" && (
          <div className="space-y-4 p-5">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
              <div>
                <div className="text-xs font-bold text-white">Treasury created</div>
                <p className="mt-1 text-xs leading-relaxed text-emerald-100">
                  <span className="font-semibold">{details.name}</span> is live on Stellar
                  Testnet with {details.members.length} members and {thresholdClamped} of{" "}
                  {details.members.length} approvals needed to spend.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3">
              <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-300">
                {stage.contractId}
              </code>
              <button
                onClick={() => void copyContractId(stage.contractId)}
                aria-label="Copy treasury contract id"
                className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => onClose(stage.contractId)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Done
              </button>
              <button
                onClick={() => openTreasury(stage.contractId)}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition"
              >
                Open treasury
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
