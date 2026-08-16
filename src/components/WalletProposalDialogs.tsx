"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  approveFlow,
  createProposalFlow,
  executeFlow,
  signatureError,
  stellarProposalExecutor,
  type ApproveFlow,
  type CreateProposalFlow,
  type CreateProposalReview,
  type ExecuteFlow,
  type ExecuteProposalReview,
  type PrepareApproveOutcome,
  type PrepareCreateOutcome,
  type PrepareExecuteOutcome,
  type ProposalError,
} from "@/lib/proposal-flow";
import type { WalletSignatureResult } from "@/lib/wallet-adapter";
import { formatBaseAmount, parseHumanAmountToBaseUnits } from "@/lib/money";
import { isValidStellarAddress } from "@/lib/stellar";
import { walletExplorerUrl, walletProposalHref } from "@/lib/app-routes";
import { useWallet } from "@/context/WalletContext";
import type {
  ChainProposalStatus,
  ChainProposalView,
  ChainTreasuryView,
  CoholdRpc,
} from "@/lib/contract-adapter";
import { WalletApprovalRail, WalletStatusChip } from "@/components/WalletChainStatus";
import {
  Send,
  ShieldCheck,
  User,
  TriangleAlert,
  FileSpreadsheet,
  ExternalLink,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  X,
} from "lucide-react";

type ReviewSimulation = "not-run" | "running" | "passed" | "failed";

type CreateStage =
  | { kind: "form" }
  | {
      kind: "review";
      review: CreateProposalReview;
      simulation: ReviewSimulation;
      preparedTxXdr?: string;
      simulationError?: ProposalError;
      previewProposalId: number | null;
    }
  | {
      kind: "signing";
      review: CreateProposalReview;
      preparedTxXdr: string;
      previewProposalId: number | null;
    }
  | {
      kind: "submitting";
      review: CreateProposalReview;
      preparedTxXdr: string;
      previewProposalId: number | null;
    }
  | { kind: "confirming"; hash: string; previewProposalId: number | null }
  | {
      kind: "confirmed";
      hash: string;
      proposalId: number | null;
      approvalCount: number | null;
      proposalStatus: ChainProposalStatus | null;
    }
  | {
      kind: "failed";
      error: ProposalError;
      hash: string | null;
      review?: CreateProposalReview;
      preparedTxXdr?: string;
      /** send = submission was ambiguous; confirm = the chain rejected it. */
      transactionPhase: "send" | "confirm";
      previewProposalId: number | null;
    };

type ApproveStage =
  | { kind: "review"; simulation: ReviewSimulation; preparedTxXdr?: string; simulationError?: ProposalError }
  | { kind: "signing"; preparedTxXdr: string }
  | { kind: "submitting"; preparedTxXdr: string }
  | { kind: "confirming"; hash: string }
  | {
      kind: "confirmed";
      hash: string;
      approvalCount: number | null;
      proposalStatus: ChainProposalStatus | null;
    }
  | { kind: "failed"; error: ProposalError; hash: string | null; preparedTxXdr?: string; transactionPhase: "send" | "confirm" };

type ExecuteStage =
  | {
      kind: "review";
      review: ExecuteProposalReview;
      simulation: ReviewSimulation;
      preparedTxXdr?: string;
      simulationError?: ProposalError;
    }
  | { kind: "signing"; review: ExecuteProposalReview; preparedTxXdr: string }
  | { kind: "submitting"; review: ExecuteProposalReview; preparedTxXdr: string }
  | { kind: "confirming"; hash: string }
  | {
      kind: "confirmed";
      hash: string;
      approvalCount: number | null;
      proposalStatus: ChainProposalStatus | null;
      treasuryBalanceBaseUnits: string | null;
    }
  | {
      kind: "failed";
      error: ProposalError;
      hash: string | null;
      review?: ExecuteProposalReview;
      preparedTxXdr?: string;
      transactionPhase: "send" | "confirm";
    };

interface WalletCreateProposalDialogProps {
  treasury: ChainTreasuryView;
  rpc: CoholdRpc;
  onClose: () => void;
  /** Called after a confirmed proposal so the parent re-reads treasury state. */
  onConfirmed: () => void;
}

export function WalletCreateProposalDialog({
  treasury,
  rpc,
  onClose,
  onConfirmed,
}: WalletCreateProposalDialogProps) {
  const router = useRouter();
  const { freighterAddress, signTransaction } = useWallet();
  const memberAddress = freighterAddress?.toUpperCase() ?? null;
  const [stage, setStage] = useState<CreateStage>({ kind: "form" });
  const [amountInput, setAmountInput] = useState("");
  const [recipientInput, setRecipientInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);

  const decimals = treasury.tokenDecimals;
  const symbol = treasury.tokenSymbol;

  const flow: CreateProposalFlow | null = useMemo(() => {
    if (!memberAddress) return null;
    return createProposalFlow({
      executor: stellarProposalExecutor(),
      contractId: treasury.contractId,
      treasuryName: treasury.name,
      memberAddress,
      asset: {
        contractId: treasury.tokenAddress,
        symbol,
        decimals,
      },
      treasuryBalanceBaseUnits: treasury.balance,
      isMember: () => rpc.isMember(treasury.contractId, memberAddress),
      readProposal: async (proposalId) => {
        const record = await rpc.getProposal(treasury.contractId, proposalId);
        if (!record) return null;
        return {
          proposalId: record.id,
          proposer: record.proposer,
          approvalCount: record.approvalCount,
          status: record.status,
          amountBaseUnits: record.amount.toString(),
          recipient: record.recipient,
        };
      },
      readLatestProposalId: () => rpc.getProposalCount(treasury.contractId),
      signTransaction,
    });
  }, [rpc, treasury, memberAddress, signTransaction, symbol, decimals]);

  const withBusy = useCallback(
    async <T,>(work: () => Promise<T>): Promise<T | null> => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      try {
        return await work();
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [],
  );

  const formatDisplay = useCallback(
    (baseUnits: string): string => {
      if (decimals === null) return `${formatBaseAmount(baseUnits, 0)} base units`;
      return formatBaseAmount(baseUnits, decimals, symbol ?? "token");
    },
    [decimals, symbol],
  );

  const runSimulate = useCallback(async () => {
    if (!flow) return;
    let units: bigint;
    try {
      units = parseHumanAmountToBaseUnits(amountInput, decimals ?? 0);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Enter a valid amount");
      return;
    }
    if (recipientInput.trim() && !isValidStellarAddress(recipientInput.trim())) {
      setFormError("Recipient must be a valid Stellar address (G…).");
      return;
    }
    if (!descriptionInput.trim()) {
      setFormError("Describe the purpose of the spending.");
      return;
    }
    setFormError(null);
    await withBusy(async () => {
      const outcome: PrepareCreateOutcome = await flow.prepare({
        amountBaseUnits: units,
        recipient: recipientInput,
        description: descriptionInput,
      });
      if (outcome.status === "ready") {
        setStage({
          kind: "review",
          review: outcome.review,
          simulation: "passed",
          preparedTxXdr: outcome.preparedTxXdr,
          previewProposalId: outcome.previewProposalId,
        });
        return;
      }
      setStage({ kind: "form" });
      setFormError(outcome.error.message);
    });
  }, [flow, amountInput, recipientInput, descriptionInput, decimals, withBusy]);

  const confirmOnce = useCallback(
    async (hash: string, previewProposalId: number | null) => {
      if (!flow) return;
      const outcome = await flow.confirm(hash, previewProposalId);
      if (outcome.status === "confirmed") {
        setStage({
          kind: "confirmed",
          hash,
          proposalId: outcome.proposalId,
          approvalCount: outcome.approvalCount,
          proposalStatus: outcome.proposalStatus,
        });
        onConfirmed();
        return;
      }
      if (outcome.status === "confirmation-pending") {
        setStage({ kind: "confirming", hash, previewProposalId });
        return;
      }
      setStage({
        kind: "failed",
        error: outcome.error,
        hash: outcome.hash,
        transactionPhase: "confirm",
        previewProposalId,
      });
    },
    [flow, onConfirmed],
  );

  const runConfirm = useCallback(
    async (hash: string, previewProposalId: number | null) => {
      await withBusy(() => confirmOnce(hash, previewProposalId));
    },
    [withBusy, confirmOnce],
  );

  const runSignAndSend = useCallback(async () => {
    if (!flow) return;
    const current = stage;
    if (current.kind !== "review" || current.simulation !== "passed") return;
    const { review, previewProposalId } = current;
    const preparedTxXdr = current.preparedTxXdr;
    if (!preparedTxXdr) return;
    setStage({ kind: "signing", review, preparedTxXdr, previewProposalId });
    await withBusy(async () => {
      const signed: WalletSignatureResult = await signTransaction(preparedTxXdr);
      if (signed.status !== "signed") {
        setStage({
          kind: "failed",
          error: signatureError(signed),
          hash: null,
          review,
          preparedTxXdr,
          transactionPhase: "send",
          previewProposalId,
        });
        return;
      }
      setStage({ kind: "submitting", review, preparedTxXdr, previewProposalId });
      const outcome = await flow.signAndSend(preparedTxXdr, signed.signedTxXdr);
      if (outcome.status === "submitted") {
        setStage({ kind: "confirming", hash: outcome.hash, previewProposalId });
        await confirmOnce(outcome.hash, previewProposalId);
        return;
      }
      setStage({
        kind: "failed",
        error: outcome.error,
        hash: outcome.error.hash ?? null,
        review,
        preparedTxXdr,
        transactionPhase: "send",
        previewProposalId,
      });
    });
  }, [flow, stage, withBusy, confirmOnce, signTransaction]);

  const reviewPane = (review: CreateProposalReview) => (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs text-slate-500">Treasury</p>
          <p className="text-right text-xs text-slate-300">
            {review.treasuryName}
            <span className="mt-0.5 block break-all font-mono text-[10px] text-slate-500">
              {review.treasuryId}
            </span>
          </p>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <p className="text-xs text-slate-500">Amount</p>
          <p className="text-right font-mono text-base font-semibold text-slate-100">
            {formatDisplay(review.amountBaseUnits)}
          </p>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <p className="text-xs text-slate-500">Asset</p>
          <p className="break-all text-right font-mono text-xs text-slate-300">
            {decimals === null
              ? review.assetContractId
              : `${review.assetSymbol ?? "token"} · ${review.assetContractId}`}
          </p>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <p className="text-xs text-slate-500">Recipient</p>
          <p className="break-all text-right font-mono text-xs text-slate-300">
            {review.recipient}
          </p>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <p className="text-xs text-slate-500">Purpose</p>
          <p className="text-right text-xs text-slate-300">{review.description}</p>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <p className="text-xs text-slate-500">Proposed by</p>
          <p className="break-all text-right font-mono text-xs text-slate-300">
            {review.proposerAddress}
          </p>
        </div>
      </div>
      <div className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <p className="text-xs text-slate-400">
          Proposal amount and recipient become immutable on-chain. You will be counted as the
          first approval, and the proposal is approved when the treasury threshold is met.
        </p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <p className="text-xs text-slate-500">Approvals after your signature</p>
        <div className="mt-2">
          <WalletApprovalRail
            approvalCount={1}
            threshold={treasury.threshold}
          />
        </div>
      </div>
      {review.treasuryBalanceBaseUnits !== null ? (
        <p className="text-xs text-slate-500">
          Treasury balance: {formatDisplay(review.treasuryBalanceBaseUnits)} — execution still
          requires the group&apos;s approval threshold and enough funds at execute time.
        </p>
      ) : (
        <p className="text-xs text-slate-500">
          Treasury balance is unavailable from the chain right now; it will be checked again at
          execution.
        </p>
      )}
    </div>
  );

  const hashLine = (hash: string) => (
    <p className="mt-1 break-all font-mono text-xs text-slate-400">
      {hash}
      <a
        href={walletExplorerUrl("tx", hash)}
        target="_blank"
        rel="noreferrer"
        className="ml-2 inline-flex items-center gap-1 text-slate-500 hover:text-slate-300"
      >
        View on Stellar Expert <ExternalLink className="h-3 w-3" />
      </a>
    </p>
  );

  const inFlight =
    stage.kind === "signing" || stage.kind === "submitting" || stage.kind === "confirming";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Create proposal in ${treasury.name}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">New proposal</h2>
              <p className="text-xs text-slate-400">{treasury.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close new proposal dialog"
            disabled={busy}
            title={busy ? "Transaction in flight — keep this dialog open." : undefined}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          {stage.kind === "form" && (
            <div className="space-y-4">
              <div>
                <label htmlFor="proposal-amount" className="text-xs font-medium text-slate-300">
                  Amount
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    id="proposal-amount"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={amountInput}
                    onChange={(event) => {
                      setAmountInput(event.target.value);
                      setFormError(null);
                    }}
                    placeholder={decimals === null ? "Base units" : "0.00"}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus:border-blue-500/60 focus:outline-none"
                  />
                  <span className="shrink-0 font-mono text-xs text-slate-400">
                    {decimals === null ? "base units" : (symbol ?? "token")}
                  </span>
                </div>
                {decimals === null && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Token decimals could not be read; enter base units (1 unit = 10⁰).
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="proposal-recipient" className="text-xs font-medium text-slate-300">
                  Recipient (G…)
                </label>
                <input
                  id="proposal-recipient"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={recipientInput}
                  onChange={(event) => {
                    setRecipientInput(event.target.value);
                    setFormError(null);
                  }}
                  placeholder="G…"
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus:border-blue-500/60 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  The address that receives the payment at execute time. The recipient does not
                  need to be a member.
                </p>
              </div>
              <div>
                <label htmlFor="proposal-description" className="text-xs font-medium text-slate-300">
                  Purpose
                </label>
                <textarea
                  id="proposal-description"
                  rows={2}
                  value={descriptionInput}
                  onChange={(event) => {
                    setDescriptionInput(event.target.value);
                    setFormError(null);
                  }}
                  placeholder="What is this spending for?"
                  className="mt-1.5 w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-blue-500/60 focus:outline-none"
                />
              </div>
              {formError && (
                <p role="alert" className="flex items-start gap-1.5 text-xs text-red-400">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {formError}
                </p>
              )}
              <button
                onClick={() => {
                  void runSimulate();
                }}
                disabled={Boolean(flow) === false || busy}
                className="mt-2 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Review and simulate on Testnet
              </button>
              <p className="text-center text-[11px] text-slate-500">
                Simulation runs first; your wallet is only asked to sign after it passes.
              </p>
            </div>
          )}

          {stage.kind === "review" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStage({ kind: "form" })}
                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Edit proposal
                </button>
              </div>
              {reviewPane(stage.review)}
              {stage.simulation === "passed" && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Simulation passed — ready to sign with Freighter.
                </p>
              )}
              {stage.simulation === "failed" && stage.simulationError && (
                <p role="alert" className="flex items-start gap-1.5 text-xs text-red-400">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {stage.simulationError.message}
                </p>
              )}
              {stage.simulation !== "passed" && (
                <button
                  onClick={() => void runSimulate()}
                  disabled={busy}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {stage.simulation === "running" ? "Simulating…" : "Simulate on Testnet"}
                </button>
              )}
              {stage.simulation === "passed" && stage.preparedTxXdr && (
                <button
                  onClick={() => void runSignAndSend()}
                  disabled={Boolean(flow) === false || busy}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Sign &amp; send with Freighter
                </button>
              )}
              {stage.simulation === "passed" && !flow && (
                <p className="flex items-center gap-1.5 text-xs text-amber-400">
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                  The wallet disconnected — connect Freighter to Testnet to sign.
                </p>
              )}
            </div>
          )}

          {(stage.kind === "signing" || stage.kind === "submitting") && (
            <div className="space-y-3">
              {reviewPane(stage.review)}
              <p className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {stage.kind === "signing"
                  ? "Awaiting your signature in Freighter…"
                  : "Submitting to Testnet…"}
              </p>
            </div>
          )}

          {stage.kind === "confirming" && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-200">Transaction submitted</p>
              {hashLine(stage.hash)}
              <p className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Confirming on Testnet — this usually takes a few seconds.
              </p>
              <button
                onClick={() => void runConfirm(stage.hash, stage.previewProposalId)}
                disabled={busy}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Check again
              </button>
            </div>
          )}

          {stage.kind === "confirmed" && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-emerald-300">
                    Proposal created on Testnet
                  </p>
                  {hashLine(stage.hash)}
                </div>
              </div>
              {stage.approvalCount !== null ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-xs text-slate-500">Approvals re-read from chain</p>
                  <div className="mt-2">
                    <WalletApprovalRail
                      approvalCount={stage.approvalCount}
                      threshold={treasury.threshold}
                    />
                  </div>
                  {stage.proposalStatus && (
                    <div className="mt-2">
                      <WalletStatusChip status={stage.proposalStatus} />
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-slate-500">
                    Your proposal counts as the first approval.
                    {stage.proposalStatus === "approved"
                      ? " The treasury threshold was already met at creation."
                      : " The proposal is pending until the threshold is met."}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <p className="flex items-start gap-1.5 text-xs text-amber-300">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    The proposal is confirmed, but its approval state could not be re-read. Use
                    the proposal list after closing this dialog.
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                {stage.proposalId !== null && (
                  <button
                    onClick={() =>
                      router.push(walletProposalHref(String(stage.proposalId), treasury.contractId))
                    }
                    className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    View proposal
                  </button>
                )}
                <button
                  onClick={onClose}
                  className={`rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 ${
                    stage.proposalId !== null ? "flex-1" : "w-full"
                  }`}
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {stage.kind === "failed" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                <p className="flex items-start gap-1.5 text-sm font-medium text-red-300">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {stage.error.message}
                </p>
                {stage.hash && <div className="mt-2">{hashLine(stage.hash)}</div>}
              </div>
              <div className="flex gap-2">
                {stage.transactionPhase === "send" && stage.hash ? (
                  <button
                    onClick={() => {
                      if (!stage.hash) return;
                      void runConfirm(stage.hash, stage.previewProposalId);
                    }}
                    disabled={busy}
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Check status on Testnet
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      stage.review && stage.preparedTxXdr
                        ? setStage({
                            kind: "review",
                            review: stage.review,
                            simulation: "passed",
                            preparedTxXdr: stage.preparedTxXdr,
                            previewProposalId: stage.previewProposalId,
                          })
                        : stage.review
                          ? setStage({
                              kind: "review",
                              review: stage.review,
                              simulation: "not-run",
                              previewProposalId: stage.previewProposalId,
                            })
                          : setStage({ kind: "form" })
                    }
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                  >
                    Try again
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
              {stage.transactionPhase === "send" && stage.hash && (
                <p className="text-center text-[11px] text-slate-500">
                  Submission was ambiguous — check before retrying so you never create the
                  proposal twice.
                </p>
              )}
            </div>
          )}
        </div>

        {inFlight && (
          <div className="border-t border-slate-800 bg-slate-950 px-6 py-3">
            <p className="text-center text-[11px] text-slate-500">
              Keep this dialog open — the transaction is in flight.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Approve dialog. The reviewed proposal facts come from the chain-backed
// ChainProposalView prop — never from request input.
// ---------------------------------------------------------------------------

export function WalletApproveDialog({
  proposal,
  treasury,
  rpc,
  onClose,
  onConfirmed,
}: {
  proposal: ChainProposalView;
  treasury: ChainTreasuryView;
  rpc: CoholdRpc;
  onClose: () => void;
  /** Called after a confirmed approval so the parent re-reads proposal state. */
  onConfirmed: () => void;
}) {
  const { freighterAddress, signTransaction } = useWallet();
  const memberAddress = freighterAddress?.toUpperCase() ?? null;
  const [stage, setStage] = useState<ApproveStage>({ kind: "review", simulation: "not-run" });
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);

  const decimals = proposal.tokenDecimals ?? treasury.tokenDecimals;
  const symbol = proposal.tokenSymbol ?? treasury.tokenSymbol;

  const flow: ApproveFlow | null = useMemo(() => {
    if (!memberAddress) return null;
    return approveFlow({
      executor: stellarProposalExecutor(),
      contractId: treasury.contractId,
      treasuryName: treasury.name,
      memberAddress,
      proposalId: proposal.id,
      reviewed: {
        amountBaseUnits: proposal.amount,
        recipient: proposal.recipient,
        description: proposal.description,
        assetSymbol: proposal.tokenSymbol,
        assetDecimals: proposal.tokenDecimals,
        approvalCount: proposal.approvalCount,
        threshold: proposal.threshold,
      },
      isMember: () => rpc.isMember(treasury.contractId, memberAddress),
      readProposal: async (proposalId) => {
        const record = await rpc.getProposal(treasury.contractId, proposalId);
        if (!record) return null;
        return { approvalCount: record.approvalCount, status: record.status };
      },
      signTransaction,
    });
  }, [rpc, treasury, proposal, memberAddress, signTransaction]);

  const withBusy = useCallback(
    async <T,>(work: () => Promise<T>): Promise<T | null> => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      try {
        return await work();
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [],
  );

  const formatDisplay = useCallback(
    (baseUnits: string): string => {
      if (decimals === null) return `${formatBaseAmount(baseUnits, 0)} base units`;
      return formatBaseAmount(baseUnits, decimals, symbol ?? "token");
    },
    [decimals, symbol],
  );

  const runSimulate = useCallback(async () => {
    if (!flow) return;
    setStage({ kind: "review", simulation: "running" });
    await withBusy(async () => {
      const outcome: PrepareApproveOutcome = await flow.prepare();
      if (outcome.status === "ready") {
        setStage({
          kind: "review",
          simulation: "passed",
          preparedTxXdr: outcome.preparedTxXdr,
        });
        return;
      }
      setStage({
        kind: "review",
        simulation: "failed",
        simulationError: outcome.error,
      });
    });
  }, [flow, withBusy]);

  const confirmOnce = useCallback(
    async (hash: string) => {
      if (!flow) return;
      const outcome = await flow.confirm(hash);
      if (outcome.status === "confirmed") {
        setStage({
          kind: "confirmed",
          hash,
          approvalCount: outcome.approvalCount,
          proposalStatus: outcome.proposalStatus,
        });
        onConfirmed();
        return;
      }
      if (outcome.status === "confirmation-pending") {
        setStage({ kind: "confirming", hash });
        return;
      }
      setStage({
        kind: "failed",
        error: outcome.error,
        hash: outcome.hash,
        transactionPhase: "confirm",
      });
    },
    [flow, onConfirmed],
  );

  const runConfirm = useCallback(
    async (hash: string) => {
      await withBusy(() => confirmOnce(hash));
    },
    [withBusy, confirmOnce],
  );

  const runSignAndSend = useCallback(async () => {
    if (!flow) return;
    const current = stage;
    if (current.kind !== "review" || current.simulation !== "passed") return;
    const preparedTxXdr = current.preparedTxXdr;
    if (!preparedTxXdr) return;
    setStage({ kind: "signing", preparedTxXdr });
    await withBusy(async () => {
      const signed: WalletSignatureResult = await signTransaction(preparedTxXdr);
      if (signed.status !== "signed") {
        setStage({
          kind: "failed",
          error: signatureError(signed),
          hash: null,
          preparedTxXdr,
          transactionPhase: "send",
        });
        return;
      }
      setStage({ kind: "submitting", preparedTxXdr });
      const outcome = await flow.signAndSend(preparedTxXdr, signed.signedTxXdr);
      if (outcome.status === "submitted") {
        setStage({ kind: "confirming", hash: outcome.hash });
        await confirmOnce(outcome.hash);
        return;
      }
      setStage({
        kind: "failed",
        error: outcome.error,
        hash: outcome.error.hash ?? null,
        preparedTxXdr,
        transactionPhase: "send",
      });
    });
  }, [flow, stage, withBusy, confirmOnce, signTransaction]);

  const reviewPane = () => (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs text-slate-500">Treasury</p>
          <p className="text-right text-xs text-slate-300">
            {treasury.name}
            <span className="mt-0.5 block break-all font-mono text-[10px] text-slate-500">
              {treasury.contractId}
            </span>
          </p>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <p className="text-xs text-slate-500">Amount</p>
          <p className="text-right font-mono text-base font-semibold text-slate-100">
            {formatDisplay(proposal.amount)}
          </p>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <p className="text-xs text-slate-500">Asset</p>
          <p className="break-all text-right font-mono text-xs text-slate-300">
            {decimals === null
              ? treasury.tokenAddress
              : `${symbol ?? "token"} · ${treasury.tokenAddress}`}
          </p>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <p className="text-xs text-slate-500">Recipient</p>
          <p className="break-all text-right font-mono text-xs text-slate-300">
            {proposal.recipient}
          </p>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <p className="text-xs text-slate-500">Purpose</p>
          <p className="text-right text-xs text-slate-300">{proposal.description}</p>
        </div>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <p className="text-xs text-slate-500">Approvals before your signature</p>
        <div className="mt-2">
          <WalletApprovalRail
            approvalCount={proposal.approvalCount}
            threshold={proposal.threshold}
          />
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs text-slate-400">
          <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
          You are approving as{" "}
          <span className="break-all font-mono text-slate-300">{memberAddress}</span>
        </p>
      </div>
      <div className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <p className="text-xs text-slate-400">
          Approving adds your signature to this proposal&apos;s approval count. Each member can
          approve once; the proposal approves automatically when the threshold is met.
        </p>
      </div>
    </div>
  );

  const hashLine = (hash: string) => (
    <p className="mt-1 break-all font-mono text-xs text-slate-400">
      {hash}
      <a
        href={walletExplorerUrl("tx", hash)}
        target="_blank"
        rel="noreferrer"
        className="ml-2 inline-flex items-center gap-1 text-slate-500 hover:text-slate-300"
      >
        View on Stellar Expert <ExternalLink className="h-3 w-3" />
      </a>
    </p>
  );

  const inFlight =
    stage.kind === "signing" || stage.kind === "submitting" || stage.kind === "confirming";
  const simulationPassed = stage.kind === "review" && stage.simulation === "passed";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Approve proposal #${proposal.id}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Approve proposal <span className="font-mono">#{proposal.id}</span>
              </h2>
              <p className="text-xs text-slate-400">{treasury.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close approve proposal dialog"
            disabled={busy}
            title={busy ? "Transaction in flight — keep this dialog open." : undefined}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          {stage.kind === "review" && (
            <div className="space-y-4">
              {reviewPane()}
              {stage.simulation === "running" && (
                <p className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Simulating on Testnet…
                </p>
              )}
              {stage.simulation === "passed" && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Simulation passed — ready to sign with Freighter.
                </p>
              )}
              {stage.simulation === "failed" && stage.simulationError && (
                <p role="alert" className="flex items-start gap-1.5 text-xs text-red-400">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {stage.simulationError.message}
                </p>
              )}
              {stage.simulation !== "passed" && (
                <button
                  onClick={() => void runSimulate()}
                  disabled={!flow || busy}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {stage.simulation === "running" ? "Simulating…" : "Simulate on Testnet"}
                </button>
              )}
              {simulationPassed && stage.preparedTxXdr && (
                <button
                  onClick={() => void runSignAndSend()}
                  disabled={!flow || busy}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Sign &amp; approve with Freighter
                </button>
              )}
              {simulationPassed && stage.preparedTxXdr && !flow && (
                <p className="flex items-center gap-1.5 text-xs text-amber-400">
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                  The wallet disconnected — connect Freighter to Testnet to sign.
                </p>
              )}
              {!flow && (
                <p className="text-center text-[11px] text-slate-500">
                  Connect Freighter on Stellar Testnet to approve.
                </p>
              )}
            </div>
          )}

          {(stage.kind === "signing" || stage.kind === "submitting") && (
            <div className="space-y-3">
              {reviewPane()}
              <p className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {stage.kind === "signing"
                  ? "Awaiting your signature in Freighter…"
                  : "Submitting to Testnet…"}
              </p>
            </div>
          )}

          {stage.kind === "confirming" && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-200">Transaction submitted</p>
              {hashLine(stage.hash)}
              <p className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Confirming on Testnet — this usually takes a few seconds.
              </p>
              <button
                onClick={() => {
                  if (!stage.hash) return;
                  void runConfirm(stage.hash);
                }}
                disabled={busy}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Check again
              </button>
            </div>
          )}

          {stage.kind === "confirmed" && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-emerald-300">
                    Approval confirmed on Testnet
                  </p>
                  {hashLine(stage.hash)}
                </div>
              </div>
              {stage.approvalCount !== null ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-xs text-slate-500">Approvals re-read from chain</p>
                  <div className="mt-2">
                    <WalletApprovalRail
                      approvalCount={stage.approvalCount}
                      threshold={proposal.threshold}
                    />
                  </div>
                  {stage.proposalStatus && (
                    <div className="mt-2">
                      <WalletStatusChip status={stage.proposalStatus} />
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-slate-500">
                    {stage.proposalStatus === "approved"
                      ? "The approval threshold is met — this proposal is approved."
                      : "The proposal is still pending until the threshold is met."}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <p className="flex items-start gap-1.5 text-xs text-amber-300">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Your approval is confirmed, but the proposal state could not be re-read.
                    Refresh from chain after closing this dialog.
                  </p>
                </div>
              )}
              <button
                onClick={onClose}
                className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                Back to proposal
              </button>
            </div>
          )}

          {stage.kind === "failed" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                <p className="flex items-start gap-1.5 text-sm font-medium text-red-300">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {stage.error.message}
                </p>
                {stage.hash && <div className="mt-2">{hashLine(stage.hash)}</div>}
              </div>
              <div className="flex gap-2">
                {stage.transactionPhase === "send" && stage.hash ? (
                  <button
                    onClick={() => {
                      if (!stage.hash) return;
                      void runConfirm(stage.hash);
                    }}
                    disabled={busy}
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Check status on Testnet
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      stage.preparedTxXdr && stage.transactionPhase === "send"
                        ? setStage({
                            kind: "review",
                            simulation: "passed",
                            preparedTxXdr: stage.preparedTxXdr,
                          })
                        : setStage({ kind: "review", simulation: "not-run" })
                    }
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                  >
                    Try again
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
              {stage.transactionPhase === "send" && stage.hash && (
                <p className="text-center text-[11px] text-slate-500">
                  Submission was ambiguous — check before retrying; approving twice is rejected
                  by the contract, but the status check is authoritative.
                </p>
              )}
            </div>
          )}
        </div>

        {inFlight && (
          <div className="border-t border-slate-800 bg-slate-950 px-6 py-3">
            <p className="text-center text-[11px] text-slate-500">
              Keep this dialog open — the transaction is in flight.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function WalletExecuteDialog({
  proposal,
  treasury,
  rpc,
  onClose,
  onConfirmed,
}: {
  proposal: ChainProposalView;
  treasury: ChainTreasuryView;
  rpc: CoholdRpc;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const { freighterAddress, signTransaction } = useWallet();
  const callerAddress = freighterAddress?.toUpperCase() ?? null;
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);

  const decimals = proposal.tokenDecimals ?? treasury.tokenDecimals;
  const symbol = proposal.tokenSymbol ?? treasury.tokenSymbol;
  const executeReview = useMemo<ExecuteProposalReview>(
    () => ({
      treasuryId: treasury.contractId,
      treasuryName: treasury.name,
      callerAddress: callerAddress ?? "",
      proposalId: proposal.id,
      status: proposal.status,
      amountBaseUnits: proposal.amount,
      recipient: proposal.recipient,
      description: proposal.description,
      assetContractId: treasury.tokenAddress,
      assetSymbol: proposal.tokenSymbol ?? treasury.tokenSymbol,
      assetDecimals: proposal.tokenDecimals ?? treasury.tokenDecimals,
      approvalCount: proposal.approvalCount,
      threshold: proposal.threshold,
      treasuryBalanceBaseUnits: treasury.balance,
    }),
    [callerAddress, proposal, treasury],
  );

  const [stage, setStage] = useState<ExecuteStage>({
    kind: "review",
    review: executeReview,
    simulation: "not-run",
  });

  const flow: ExecuteFlow | null = useMemo(() => {
    if (!callerAddress) return null;
    return executeFlow({
      executor: stellarProposalExecutor(),
      contractId: treasury.contractId,
      treasuryName: treasury.name,
      callerAddress,
      proposalId: proposal.id,
      reviewed: {
        ...executeReview,
      },
      readProposal: async (proposalId) => {
        const record = await rpc.getProposal(treasury.contractId, proposalId);
        if (!record) return null;
        return { approvalCount: record.approvalCount, status: record.status };
      },
      readBalance: async () => {
        const next = await rpc.getBalance(treasury.contractId);
        return next;
      },
      signTransaction,
    });
  }, [rpc, treasury, proposal, callerAddress, signTransaction, executeReview]);

  const withBusy = useCallback(
    async <T,>(work: () => Promise<T>): Promise<T | null> => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      try {
        return await work();
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [],
  );

  const formatDisplay = useCallback(
    (baseUnits: string): string => {
      if (decimals === null) return `${formatBaseAmount(baseUnits, 0)} base units`;
      return formatBaseAmount(baseUnits, decimals, symbol ?? "token");
    },
    [decimals, symbol],
  );

  const runSimulate = useCallback(async () => {
    if (!flow) return;
    setStage({ kind: "review", review: executeReview, simulation: "running" });
    await withBusy(async () => {
      const outcome: PrepareExecuteOutcome = await flow.prepare();
      if (outcome.status === "ready") {
        setStage({
        kind: "review",
        review: outcome.review,
        simulation: "passed",
        preparedTxXdr: outcome.preparedTxXdr,
      });
        return;
      }
      setStage({
        kind: "review",
        review: executeReview,
        simulation: "failed",
        simulationError: outcome.error,
      });
    });
  }, [flow, withBusy, executeReview]);

  const confirmOnce = useCallback(
    async (hash: string) => {
      if (!flow) return;
      const outcome = await flow.confirm(hash);
      if (outcome.status === "confirmed") {
        setStage({
          kind: "confirmed",
          hash,
          approvalCount: outcome.approvalCount,
          proposalStatus: outcome.proposalStatus,
          treasuryBalanceBaseUnits: outcome.treasuryBalanceBaseUnits,
        });
        onConfirmed();
        return;
      }
      if (outcome.status === "confirmation-pending") {
        setStage({ kind: "confirming", hash });
        return;
      }
      setStage({
        kind: "failed",
        error: outcome.error,
        hash: outcome.hash,
        transactionPhase: "confirm",
      });
    },
    [flow, onConfirmed],
  );

  const runConfirm = useCallback(
    async (hash: string) => {
      await withBusy(() => confirmOnce(hash));
    },
    [withBusy, confirmOnce],
  );

  const runSignAndSend = useCallback(async () => {
    if (!flow) return;
    const current = stage;
    if (current.kind !== "review" || current.simulation !== "passed") return;
    const preparedTxXdr = current.preparedTxXdr;
    if (!preparedTxXdr) return;
    setStage({ kind: "signing", review: current.review, preparedTxXdr });
    await withBusy(async () => {
      const signed: WalletSignatureResult = await signTransaction(preparedTxXdr);
      if (signed.status !== "signed") {
        setStage({
          kind: "failed",
          error: signatureError(signed),
          hash: null,
          review: current.review,
          preparedTxXdr,
          transactionPhase: "send",
        });
        return;
      }
      setStage({ kind: "submitting", review: current.review, preparedTxXdr });
      const outcome = await flow.signAndSend(preparedTxXdr, signed.signedTxXdr);
      if (outcome.status === "submitted") {
        setStage({ kind: "confirming", hash: outcome.hash });
        await confirmOnce(outcome.hash);
        return;
      }
      setStage({
        kind: "failed",
        error: outcome.error,
        hash: outcome.error.hash ?? null,
        review: current.review,
        preparedTxXdr,
        transactionPhase: "send",
      });
    });
  }, [flow, stage, withBusy, confirmOnce, signTransaction]);

  const reviewPane = () => (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs text-slate-500">Treasury</p>
          <p className="text-right text-xs text-slate-300">
            {treasury.name}
            <span className="mt-0.5 block break-all font-mono text-[10px] text-slate-500">
              {treasury.contractId}
            </span>
          </p>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <p className="text-xs text-slate-500">Amount</p>
          <p className="text-right font-mono text-base font-semibold text-slate-100">
            {formatDisplay(proposal.amount)}
          </p>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <p className="text-xs text-slate-500">Asset</p>
          <p className="break-all text-right font-mono text-xs text-slate-300">
            {decimals === null
              ? treasury.tokenAddress
              : `${symbol ?? "token"} · ${treasury.tokenAddress}`}
          </p>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <p className="text-xs text-slate-500">Recipient</p>
          <p className="break-all text-right font-mono text-xs text-slate-300">
            {proposal.recipient}
          </p>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <p className="text-xs text-slate-500">Purpose</p>
          <p className="text-right text-xs text-slate-300">{proposal.description}</p>
        </div>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <p className="text-xs text-slate-500">Approvals before execution</p>
        <div className="mt-2">
          <WalletApprovalRail
            approvalCount={proposal.approvalCount}
            threshold={proposal.threshold}
          />
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs text-slate-400">
          <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
          You are executing as <span className="break-all font-mono text-slate-300">{callerAddress}</span>
        </p>
      </div>
      <div className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <p className="text-xs text-slate-400">
          Execution is only offered when the proposal is approved and the treasury can pay. The
          contract is re-simulated before signing, then the chain is re-read after RPC success.
        </p>
      </div>
    </div>
  );

  const hashLine = (hash: string) => (
    <p className="mt-1 break-all font-mono text-xs text-slate-400">
      {hash}
      <a
        href={walletExplorerUrl("tx", hash)}
        target="_blank"
        rel="noreferrer"
        className="ml-2 inline-flex items-center gap-1 text-slate-500 hover:text-slate-300"
      >
        View on Stellar Expert <ExternalLink className="h-3 w-3" />
      </a>
    </p>
  );

  const inFlight =
    stage.kind === "signing" || stage.kind === "submitting" || stage.kind === "confirming";
  const simulationPassed = stage.kind === "review" && stage.simulation === "passed";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Execute proposal #${proposal.id}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Execute proposal <span className="font-mono">#{proposal.id}</span>
              </h2>
              <p className="text-xs text-slate-400">{treasury.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close execute proposal dialog"
            disabled={busy}
            title={busy ? "Transaction in flight — keep this dialog open." : undefined}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          {stage.kind === "review" && (
            <div className="space-y-4">
              {reviewPane()}
              {stage.simulation === "running" && (
                <p className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Simulating on Testnet…
                </p>
              )}
              {stage.simulation === "passed" && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Simulation passed — ready to sign with Freighter.
                </p>
              )}
              {stage.simulation === "failed" && stage.simulationError && (
                <p role="alert" className="flex items-start gap-1.5 text-xs text-red-400">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {stage.simulationError.message}
                </p>
              )}
              {stage.simulation !== "passed" && (
                <button
                  onClick={() => void runSimulate()}
                  disabled={!flow || busy}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {stage.simulation === "running" ? "Simulating…" : "Simulate on Testnet"}
                </button>
              )}
              {simulationPassed && stage.preparedTxXdr && (
                <button
                  onClick={() => void runSignAndSend()}
                  disabled={!flow || busy}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Sign &amp; execute with Freighter
                </button>
              )}
              {simulationPassed && stage.preparedTxXdr && !flow && (
                <p className="flex items-center gap-1.5 text-xs text-amber-400">
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                  The wallet disconnected — connect Freighter to Testnet to sign.
                </p>
              )}
              {!flow && (
                <p className="text-center text-[11px] text-slate-500">
                  Connect Freighter on Stellar Testnet to execute.
                </p>
              )}
            </div>
          )}

          {(stage.kind === "signing" || stage.kind === "submitting") && (
            <div className="space-y-3">
              {reviewPane()}
              <p className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {stage.kind === "signing"
                  ? "Awaiting your signature in Freighter…"
                  : "Submitting to Testnet…"}
              </p>
            </div>
          )}

          {stage.kind === "confirming" && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-200">Transaction submitted</p>
              {hashLine(stage.hash)}
              <p className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Confirming on Testnet — this waits for RPC SUCCESS before refreshing treasury and
                proposal state.
              </p>
              <button
                onClick={() => {
                  if (!stage.hash) return;
                  void runConfirm(stage.hash);
                }}
                disabled={busy}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Check again
              </button>
            </div>
          )}

          {stage.kind === "confirmed" && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-emerald-300">
                    Payment confirmed on Testnet
                  </p>
                  {hashLine(stage.hash)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs text-slate-500">Fresh chain read after success</p>
                <div className="mt-2">
                  <WalletApprovalRail
                    approvalCount={stage.approvalCount ?? proposal.approvalCount}
                    threshold={proposal.threshold}
                  />
                </div>
                <div className="mt-2">
                  <WalletStatusChip status={stage.proposalStatus ?? proposal.status} />
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Treasury balance: {stage.treasuryBalanceBaseUnits ?? treasury.balance ?? "unavailable"}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                Back to proposal
              </button>
            </div>
          )}

          {stage.kind === "failed" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                <p className="flex items-start gap-1.5 text-sm font-medium text-red-300">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {stage.error.message}
                </p>
                {stage.hash && <div className="mt-2">{hashLine(stage.hash)}</div>}
              </div>
              <div className="flex gap-2">
                {stage.transactionPhase === "send" && stage.hash ? (
                  <button
                    onClick={() => {
                      if (!stage.hash) return;
                      void runConfirm(stage.hash);
                    }}
                    disabled={busy}
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Check confirmation
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      stage.review && stage.preparedTxXdr
                        ? setStage({
                            kind: "review",
                            review: stage.review,
                            simulation: "passed",
                            preparedTxXdr: stage.preparedTxXdr,
                          })
                        : setStage({ kind: "review", review: executeReview, simulation: "not-run" })
                    }
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                  >
                    Try again
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
              {stage.transactionPhase === "send" && stage.hash && (
                <p className="text-center text-[11px] text-slate-500">
                  Submission was ambiguous — check before retrying so you never execute the payment
                  twice.
                </p>
              )}
            </div>
          )}
        </div>

        {inFlight && (
          <div className="border-t border-slate-800 bg-slate-950 px-6 py-3">
            <p className="text-center text-[11px] text-slate-500">
              Keep this dialog open — the transaction is in flight.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}