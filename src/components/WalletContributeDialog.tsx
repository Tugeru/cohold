"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  createContributeFlow,
  stellarContributeExecutor,
  type ContributeError,
  type ContributeFlow,
  type ContributeReview,
} from "@/lib/contribute-flow";
import { formatBaseAmount, parseHumanAmountToBaseUnits } from "@/lib/money";
import { walletExplorerUrl } from "@/lib/app-routes";
import { useWallet } from "@/context/WalletContext";
import type { ChainTreasuryView, CoholdRpc } from "@/lib/contract-adapter";
import { useModalA11y } from "@/components/useModalA11y";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Coins,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";

type ReviewSimulation = "not-run" | "running" | "passed" | "failed";

type ContributeStage =
  | { kind: "amount" }
  | {
      kind: "review";
      review: ContributeReview;
      simulation: ReviewSimulation;
      preparedTxXdr?: string;
      simulationError?: ContributeError;
    }
  | { kind: "signing"; review: ContributeReview; preparedTxXdr: string }
  | { kind: "submitting"; review: ContributeReview; preparedTxXdr: string }
  | { kind: "confirming"; hash: string }
  | { kind: "confirmed"; hash: string; balanceBaseUnits: string | null }
  | {
      kind: "failed";
      error: ContributeError;
      hash: string | null;
      review?: ContributeReview;
      preparedTxXdr?: string;
    };

interface WalletContributeDialogProps {
  treasury: ChainTreasuryView;
  rpc: CoholdRpc;
  onClose: () => void;
  /** Called after a confirmed contribution so the parent re-reads the treasury. */
  onConfirmed: () => void;
}

export function WalletContributeDialog({
  treasury,
  rpc,
  onClose,
  onConfirmed,
}: WalletContributeDialogProps) {
  const { freighterAddress, signTransaction } = useWallet();
  const memberAddress = freighterAddress?.toUpperCase() ?? null;
  const [stage, setStage] = useState<ContributeStage>({ kind: "amount" });
  const [amountInput, setAmountInput] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const dialogRef = useModalA11y(onClose, busy);

  const decimals = treasury.tokenDecimals;
  const symbol = treasury.tokenSymbol;

  const flow: ContributeFlow | null = useMemo(() => {
    if (!memberAddress) return null;
    return createContributeFlow({
      executor: stellarContributeExecutor(),
      contractId: treasury.contractId,
      memberAddress,
      asset: {
        contractId: treasury.tokenAddress,
        symbol,
        decimals,
      },
      currentBalanceBaseUnits: treasury.balance,
      isMember: () => rpc.isMember(treasury.contractId, memberAddress),
      readBalance: () => rpc.getBalance(treasury.contractId),
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

  const previewAmount = useMemo(() => {
    if (!amountInput) return null;
    try {
      return parseHumanAmountToBaseUnits(amountInput, decimals ?? 0);
    } catch {
      return null;
    }
  }, [amountInput, decimals]);

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
      setAmountError(error instanceof Error ? error.message : "Enter a valid amount");
      return;
    }
    setAmountError(null);
    await withBusy(async () => {
      const outcome = await flow.prepare(units);
      if (outcome.status === "ready") {
        setStage({
          kind: "review",
          review: outcome.review,
          simulation: "passed",
          preparedTxXdr: outcome.preparedTxXdr,
        });
        return;
      }
      setStage({ kind: "amount" });
      setAmountError(outcome.error.message);
    });
  }, [flow, amountInput, decimals, withBusy]);

  const confirmOnce = useCallback(
    async (hash: string) => {
      if (!flow) return;
      const outcome = await flow.confirm(hash);
      if (outcome.status === "confirmed") {
        setStage({ kind: "confirmed", hash, balanceBaseUnits: outcome.balanceBaseUnits });
        onConfirmed();
        return;
      }
      if (outcome.status === "confirmation-pending") {
        setStage({ kind: "confirming", hash });
        return;
      }
      setStage({ kind: "failed", error: outcome.error, hash: outcome.hash });
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
    const { review } = current;
    const preparedTxXdr = current.preparedTxXdr;
    if (!preparedTxXdr) return;
    setStage({ kind: "signing", review, preparedTxXdr });
    await withBusy(async () => {
      const outcome = await flow.signAndSend(preparedTxXdr);
      if (outcome.status === "submitted") {
        setStage({ kind: "confirming", hash: outcome.hash });
        await confirmOnce(outcome.hash);
        return;
      }
      setStage({
        kind: "failed",
        error: outcome.error,
        hash: null,
        review,
        preparedTxXdr,
      });
    });
  }, [flow, stage, withBusy, confirmOnce]);

  const retryBalance = useCallback(async () => {
    if (!flow || stage.kind !== "confirmed") return;
    const balance = await flow.reReadBalance();
    setStage({ kind: "confirmed", hash: stage.hash, balanceBaseUnits: balance });
  }, [flow, stage]);

  const previewPane =
    stage.kind === "amount" ? (
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <p className="text-xs text-slate-500">Current treasury balance</p>
        <p className="mt-1 font-mono tabular-nums text-lg font-semibold text-slate-200">
          {treasury.balance === null
            ? "Unavailable"
            : formatDisplay(treasury.balance)}
        </p>
        <p className="mt-3 text-xs text-slate-500">Resulting balance after this contribution</p>
        <p className="mt-1 font-mono tabular-nums text-lg font-semibold text-slate-200">
          {treasury.balance === null || previewAmount === null
            ? "—"
            : formatDisplay((BigInt(treasury.balance) + previewAmount).toString())}
        </p>
        {previewAmount !== null && treasury.balance !== null && (
          <p className="mt-1 text-[11px] text-emerald-400/80">
            + {formatDisplay(previewAmount.toString())}
          </p>
        )}
      </div>
    ) : null;

  const reviewPane = (review: ContributeReview) => (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">Amount</p>
          <p className="font-mono tabular-nums text-lg font-semibold text-slate-100">
            {formatDisplay(review.amountBaseUnits)}
          </p>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-slate-500">Asset</p>
          <p className="font-mono tabular-nums text-xs text-slate-300">
            {decimals === null
              ? `${treasury.tokenAddress.slice(0, 12)}…`
              : `${symbol ?? "token"} · ${treasury.tokenAddress.slice(0, 12)}…`}
          </p>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-slate-500">Current balance</p>
          <p className="font-mono tabular-nums text-xs text-slate-300">
            {review.currentBalanceBaseUnits === null
              ? "Unavailable"
              : formatDisplay(review.currentBalanceBaseUnits)}
          </p>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-slate-500">Resulting balance</p>
          <p className="font-mono tabular-nums text-xs font-semibold text-slate-200">
            {review.resultingBalanceBaseUnits === null
              ? "Unavailable"
              : formatDisplay(review.resultingBalanceBaseUnits)}
          </p>
        </div>
      </div>
      <div className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <p className="text-xs text-slate-400">
          Funds added to this treasury become shared treasury funds and cannot be individually
          withdrawn in the MVP.
        </p>
      </div>
    </div>
  );

  const hashLine = (hash: string) => (
    <p className="mt-1 break-all font-mono tabular-nums text-xs text-slate-400">
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
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Add funds to ${treasury.name}`}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Add funds</h2>
              <p className="text-xs text-slate-400">{treasury.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close add funds dialog"
            disabled={busy}
            title={busy ? "Transaction in flight — keep this dialog open." : undefined}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          {stage.kind === "amount" && (
            <div>
              <label htmlFor="contribute-amount" className="text-xs font-medium text-slate-300">
                Contribution amount
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  id="contribute-amount"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={amountInput}
                  onChange={(event) => {
                    setAmountInput(event.target.value);
                    setAmountError(null);
                  }}
                  placeholder={decimals === null ? "Base units" : "0.00"}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono tabular-nums text-sm text-slate-100 focus:border-emerald-500/60 focus:outline-none"
                />
                <span className="shrink-0 font-mono tabular-nums text-xs text-slate-400">
                  {decimals === null ? "base units" : (symbol ?? "token")}
                </span>
              </div>
              {decimals === null && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Token decimals could not be read; enter base units (1 unit = 10⁰).
                </p>
              )}
              {amountError && (
                <p role="alert" className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {amountError}
                </p>
              )}
              {previewPane}
              <button
                onClick={() => {
                  void runSimulate();
                }}
                disabled={Boolean(flow) === false || busy}
                className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Review and simulate on Testnet
              </button>
              <p className="mt-2 text-center text-[11px] text-slate-500">
                Simulation runs first; your wallet is only asked to sign after it passes.
              </p>
            </div>
          )}

          {stage.kind === "review" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStage({ kind: "amount" })}
                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Edit amount
                </button>
              </div>
              {reviewPane(stage.review)}
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
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
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
                  disabled={busy}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Sign &amp; send with Freighter
                </button>
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
                onClick={() => void runConfirm(stage.hash)}
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
                    Contribution confirmed on Testnet
                  </p>
                  {hashLine(stage.hash)}
                </div>
              </div>
              {stage.balanceBaseUnits !== null ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-xs text-slate-500">Treasury balance re-read from chain</p>
                  <p className="mt-1 font-mono tabular-nums text-xl font-semibold text-slate-100">
                    {formatDisplay(stage.balanceBaseUnits)}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <p className="flex items-start gap-1.5 text-xs text-amber-300">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    The transaction is confirmed, but the treasury balance could not be re-read.
                    No balance is shown until a fresh read succeeds.
                  </p>
                  <button
                    onClick={() => void retryBalance()}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry balance read
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setStage({ kind: "amount" });
                    setAmountInput("");
                    setAmountError(null);
                  }}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                >
                  Add another
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
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
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {stage.error.message}
                </p>
                {stage.hash && <div className="mt-2">{hashLine(stage.hash)}</div>}
              </div>
              <div className="flex gap-2">
                {(stage.review || stage.kind === "failed") && (
                  <button
                    onClick={() =>
                      stage.review
                        ? setStage({
                            kind: "review",
                            review: stage.review,
                            simulation: "not-run",
                          })
                        : setStage({ kind: "amount" })
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