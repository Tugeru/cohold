"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  type ChainProposalView,
  type ChainTreasuryView,
  loadWalletProposal,
  loadWalletTreasury,
  stellarCoholdRpc,
} from "@/lib/contract-adapter";
import { coholdConfig, resolveWalletProposalTreasury } from "@/lib/cohold-config";
import { formatBaseAmount, parseBaseUnits, parseNonNegativeBaseUnits } from "@/lib/money";
import { APP_ROUTES, walletExplorerUrl } from "@/lib/app-routes";
import { useWallet } from "@/context/WalletContext";
import { WalletSetupState, useWalletResourceGate } from "@/components/WalletSetupState";
import { NotFoundStatus, ResourceStatus } from "@/components/ResourceStatus";
import { DetailSkeleton } from "@/components/Skeletons";
import {
  WalletApproveDialog,
  WalletExecuteDialog,
} from "@/components/WalletProposalDialogs";
import {
  WalletApprovalRail,
  WalletApprovalChip,
  WalletStatusChip,
} from "@/components/WalletChainStatus";
import {
  executeFlow,
  stellarProposalExecutor,
  type ExecuteProposalReview,
  type PrepareExecuteOutcome,
} from "@/lib/proposal-flow";
import {
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  User,
  Send,
  CalendarClock,
  BadgeCheck,
} from "lucide-react";

type ProposalDetailState =
  | { status: "loading" }
  | { status: "not_found"; message: string }
  | { status: "ready"; proposal: ChainProposalView; treasury: ChainTreasuryView }
  | { status: "error"; message: string };

const PROPOSAL_ID_PATTERN = /^[0-9]+$/;

export function WalletProposalView({ id }: { id: string }) {
  const config = coholdConfig;
  const searchParams = useSearchParams();
  const treasuryParam = searchParams.get("treasury");
  // Extra configured contracts carry their contract ID in the URL; anything
  // else (or an unconfigured value) falls back to the primary contract.
  const contractId = useMemo(
    () => resolveWalletProposalTreasury(config, treasuryParam),
    [config, treasuryParam],
  );
  const { freighterAddress, canPerformStateChange, walletActionBlockReason } = useWallet();
  const walletGate = useWalletResourceGate();
  const rpc = useMemo(() => stellarCoholdRpc(), []);
  const [state, setState] = useState<ProposalDetailState>({ status: "loading" });
  const [loadKey, setLoadKey] = useState(0);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isExecuteOpen, setIsExecuteOpen] = useState(false);
  const readyState = state.status === "ready" ? state : null;

  const refresh = useCallback(() => setLoadKey((key) => key + 1), []);
  const validId = PROPOSAL_ID_PATTERN.test(id) && Number(id) > 0 && Number.isSafeInteger(Number(id));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!contractId || !validId) return;
      setState({ status: "loading" });
      try {
        const proposalId = Number(id);
        const [proposal, treasury] = await Promise.all([
          loadWalletProposal(rpc, contractId, proposalId, freighterAddress ?? null),
          loadWalletTreasury(rpc, contractId),
        ]);
        if (cancelled) return;
        if (!treasury) {
          setState({
            status: "error",
            message: "The configured treasury could not be read from Stellar RPC.",
          });
          return;
        }
        if (!proposal) {
          setState({
            status: "not_found",
            message: "This proposal does not exist on the configured contract.",
          });
          return;
        }
        setState({ status: "ready", proposal, treasury });
      } catch (error) {
        if (cancelled) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Failed to read contract state.",
        });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [rpc, contractId, id, validId, freighterAddress, loadKey]);

  const executeReview = useMemo<ExecuteProposalReview | null>(() => {
    if (!readyState || !freighterAddress || !canPerformStateChange) return null;
    return {
      treasuryId: readyState.treasury.contractId,
      treasuryName: readyState.treasury.name,
      callerAddress: freighterAddress.toUpperCase(),
      proposalId: readyState.proposal.id,
      status: readyState.proposal.status,
      amountBaseUnits: readyState.proposal.amount,
      recipient: readyState.proposal.recipient,
      description: readyState.proposal.description,
      assetContractId: readyState.treasury.tokenAddress,
      assetSymbol: readyState.proposal.tokenSymbol,
      assetDecimals: readyState.proposal.tokenDecimals,
      approvalCount: readyState.proposal.approvalCount,
      threshold: readyState.proposal.threshold,
      treasuryBalanceBaseUnits: readyState.treasury.balance,
    };
  }, [
    readyState,
    freighterAddress,
    canPerformStateChange,
  ]);

  const executePrepKey = useMemo(() => {
    if (!executeReview) return null;
    return [
      executeReview.treasuryId,
      executeReview.proposalId,
      executeReview.status,
      executeReview.amountBaseUnits,
      executeReview.approvalCount,
      executeReview.threshold,
      executeReview.recipient,
      executeReview.description,
      executeReview.treasuryBalanceBaseUnits ?? "",
      executeReview.assetContractId,
      executeReview.assetSymbol ?? "",
      executeReview.assetDecimals ?? "",
      executeReview.callerAddress,
    ].join("|");
  }, [executeReview]);

  const [executePrep, setExecutePrep] = useState<{
    key: string | null;
    outcome: PrepareExecuteOutcome | null;
  }>({ key: null, outcome: null });

  useEffect(() => {
    let cancelled = false;
    if (!config.walletSetupComplete || !contractId || !executePrepKey || !executeReview) {
      return undefined;
    }
    const flow = executeFlow({
      executor: stellarProposalExecutor(),
      contractId,
      treasuryName: executeReview.treasuryName,
      callerAddress: executeReview.callerAddress,
      proposalId: executeReview.proposalId,
      reviewed: executeReview,
      readProposal: async () => ({
        approvalCount: executeReview.approvalCount,
        status: executeReview.status,
      }),
      readBalance: async () =>
        executeReview.treasuryBalanceBaseUnits === null
          ? null
          : parseNonNegativeBaseUnits(executeReview.treasuryBalanceBaseUnits),
      signTransaction: async () => ({
        status: "error",
        message: "Signing is not used for execute preview.",
      }),
    });
    void flow.prepare().then((outcome) => {
      if (!cancelled) setExecutePrep({ key: executePrepKey, outcome });
    });
    return () => {
      cancelled = true;
    };
  }, [config.walletSetupComplete, contractId, executePrepKey, executeReview]);

  if (walletGate || !contractId) {
    return walletGate ?? <WalletSetupState />;
  }
  if (!validId) {
    return (
      <NotFoundStatus
        title="Proposal not found"
        message="Proposal IDs are whole numbers. The requested proposal does not exist."
        href={APP_ROUTES.proposals}
        hrefLabel="All proposals"
      />
    );
  }
  if (state.status === "loading") {
    return <DetailSkeleton />;
  }
  if (state.status === "not_found") {
    return (
      <NotFoundStatus
        title="Proposal not found"
        message={state.message}
        href={APP_ROUTES.proposals}
        hrefLabel="All proposals"
      />
    );
  }
  if (state.status === "error") {
    return (
      <ResourceStatus
        title="Failed to load proposal"
        message={state.message}
        onRetry={refresh}
      />
    );
  }

  const { proposal, treasury } = state;
  const displayAmount = proposal.tokenSymbol
    ? formatBaseAmount(proposal.amount, proposal.tokenDecimals ?? 7, proposal.tokenSymbol)
    : `${proposal.amount} base units`;
  const walletAddress = freighterAddress?.toUpperCase() ?? null;
  const isMember = Boolean(
    walletAddress && treasury.membersAuthoritative && treasury.members.includes(walletAddress),
  );
  const canApprove =
    isMember &&
    proposal.currentUserApproval === "not-approved" &&
    proposal.status === "pending" &&
    canPerformStateChange;
  let approveBlockReason: string | null = null;
  if (proposal.status !== "pending") {
    approveBlockReason = "This proposal is no longer pending — it cannot receive more approvals.";
  } else if (proposal.currentUserApproval === "approved") {
    approveBlockReason = "You already approved this proposal. Each member can approve once.";
  } else if (!walletAddress) {
    approveBlockReason = "Connect Freighter on Stellar Testnet to approve this proposal.";
  } else if (!canPerformStateChange) {
    approveBlockReason =
      walletActionBlockReason ?? "Connect Freighter on Stellar Testnet to approve this proposal.";
  } else if (!treasury.membersAuthoritative) {
    approveBlockReason =
      "Membership could not be verified from the chain — connect Freighter and retry.";
  } else if (!isMember) {
    approveBlockReason = "Only members of this treasury can approve proposals.";
  } else if (proposal.currentUserApproval === "unknown") {
    approveBlockReason =
      "Your approval status could not be verified on Testnet — refresh from chain and try again.";
  }

  const executePrepOutcome = executePrep.key === executePrepKey ? executePrep.outcome : null;
  const treasuryCanPay =
    executePrepOutcome?.status === "ready" ||
    (proposal.status === "approved" &&
      canPerformStateChange &&
      state.status === "ready" &&
      state.treasury.balance !== null &&
      (() => {
        try {
          return parseNonNegativeBaseUnits(state.treasury.balance) >= parseBaseUnits(state.proposal.amount);
        } catch {
          return false;
        }
      })());
  const canExecute = executePrepOutcome?.status === "ready";
  let executeBlockReason: string | null = null;
  if (!executePrepKey) {
    executeBlockReason = "Connect Freighter on Stellar Testnet to simulate execution.";
  } else if (!executePrepOutcome) {
    executeBlockReason = "Checking execution conditions on chain…";
  } else if (proposal.status === "executed") {
    executeBlockReason = "This proposal has already been executed.";
  } else if (proposal.status === "cancelled") {
    executeBlockReason = "This proposal was cancelled and cannot execute.";
  } else if (executePrepOutcome.status === "proposal-not-approved") {
    const missing = Math.max(0, proposal.threshold - proposal.approvalCount);
    executeBlockReason =
      missing > 0
        ? `This proposal needs ${missing} more approval${missing === 1 ? "" : "s"} before it can execute.`
        : "This proposal is not approved yet.";
  } else if (executePrepOutcome.status === "already-executed") {
    executeBlockReason = executePrepOutcome.error.message;
  } else if (executePrepOutcome.status === "insufficient-balance") {
    executeBlockReason = executePrepOutcome.error.message;
  } else if (executePrepOutcome.status === "proposal-not-found") {
    executeBlockReason = executePrepOutcome.error.message;
  } else if (executePrepOutcome.status === "simulation-failed") {
    executeBlockReason = executePrepOutcome.error.message;
  } else if (!canPerformStateChange) {
    executeBlockReason =
      walletActionBlockReason ?? "Connect Freighter on Stellar Testnet to execute this proposal.";
  } else if (!treasuryCanPay) {
    executeBlockReason = "Treasury balance could not be read from the chain.";
  }

  return (
    <div className="space-y-6">
      <a
        href={contractId ? APP_ROUTES.treasury(contractId) : APP_ROUTES.treasuries}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {treasury.name}
      </a>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-100">
              <span className="font-mono tabular-nums text-slate-500">#{proposal.id}</span>{" "}
              {proposal.description}
            </h1>
            <WalletStatusChip status={proposal.status} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Proposal on {treasury.name} · Stellar Testnet
          </p>
        </div>
        <button
          onClick={refresh}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh from chain
        </button>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            <Send className="h-3 w-3" /> Amount
          </p>
          <p className="mt-2 break-words font-mono tabular-nums text-2xl font-semibold  text-slate-100">
            {displayAmount}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
              Testnet
            </span>
            <span className="text-xs text-slate-500">Contract-authoritative amount</span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Approval progress
          </p>
          <div className="mt-3">
            <WalletApprovalRail
              approvalCount={proposal.approvalCount}
              threshold={proposal.threshold}
              membersCount={treasury.membersAuthoritative ? treasury.members.length : undefined}
            />
          </div>
          <div className="mt-3">
            <WalletApprovalChip
              state={proposal.currentUserApproval}
              walletConnected={Boolean(freighterAddress)}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
        <h2 className="text-sm font-semibold text-slate-200">Details</h2>
        <dl className="mt-4 space-y-4">
          <div>
            <dt className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              <User className="h-3 w-3" /> Proposer
            </dt>
            <dd className="mt-1 flex items-center gap-2">
              <span className="break-all font-mono tabular-nums text-xs text-slate-300">{proposal.proposer}</span>
              <a
                href={walletExplorerUrl("account", proposal.proposer)}
                target="_blank"
                rel="noreferrer"
                className="text-slate-600 hover:text-slate-300"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              <Send className="h-3 w-3" /> Recipient
            </dt>
            <dd className="mt-1 flex items-center gap-2">
              <span className="break-all font-mono tabular-nums text-xs text-slate-300">
                {proposal.recipient}
              </span>
              <a
                href={walletExplorerUrl("account", proposal.recipient)}
                target="_blank"
                rel="noreferrer"
                className="text-slate-600 hover:text-slate-300"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              <CalendarClock className="h-3 w-3" /> Created
            </dt>
            <dd className="mt-1 text-xs text-slate-300">
              {new Date(proposal.createdAt * 1000).toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-200">Approve this proposal</h2>
            <p className="mt-1 text-xs text-slate-500">
              {proposal.status === "pending"
                ? "Your signature counts toward the treasury threshold."
                : "Approvals are closed for this proposal."}
            </p>
            {approveBlockReason && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-300/90">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {approveBlockReason}
              </p>
            )}
          </div>
          <button
            onClick={() => setIsApproveOpen(true)}
            disabled={!canApprove}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          >
            <BadgeCheck className="h-3.5 w-3.5" />
            Approve proposal
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-200">Execute this payment</h2>
            <p className="mt-1 text-xs text-slate-500">
              {proposal.status === "approved"
                ? "Any connected Testnet wallet can execute once the treasury is solvent."
                : "Execution unlocks after the approval threshold is met."}
            </p>
            {executeBlockReason && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-300/90">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {executeBlockReason}
              </p>
            )}
          </div>
          <button
            onClick={() => setIsExecuteOpen(true)}
            disabled={!canExecute}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          >
            <Send className="h-3.5 w-3.5" />
            {canExecute ? "Execute payment" : "Simulation pending"}
          </button>
        </div>
      </div>

      {freighterAddress && (
        <p className="text-xs text-slate-500">
          Reads use the connected wallet ({freighterAddress.slice(0, 10)}…) for your approval
          status. Amount, recipient, proposer, and approvals always come from the contract.
        </p>
      )}

      {isApproveOpen && (
        <WalletApproveDialog
          proposal={proposal}
          treasury={treasury}
          rpc={rpc}
          onClose={() => setIsApproveOpen(false)}
          onConfirmed={refresh}
        />
      )}

      {isExecuteOpen && (
        <WalletExecuteDialog
          proposal={proposal}
          treasury={treasury}
          rpc={rpc}
          onClose={() => setIsExecuteOpen(false)}
          onConfirmed={refresh}
        />
      )}
    </div>
  );
}