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
import { formatBaseAmount } from "@/lib/money";
import { APP_ROUTES, walletExplorerUrl } from "@/lib/app-routes";
import { useWallet } from "@/context/WalletContext";
import { WalletSetupState } from "@/components/WalletSetupState";
import { NotFoundStatus } from "@/components/ResourceStatus";
import { OverviewSkeleton } from "@/components/Skeletons";
import { WalletApproveDialog } from "@/components/WalletProposalDialogs";
import {
  WalletApprovalRail,
  WalletApprovalChip,
  WalletStatusChip,
} from "@/components/WalletChainStatus";
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
  const rpc = useMemo(() => stellarCoholdRpc(), []);
  const [state, setState] = useState<ProposalDetailState>({ status: "loading" });
  const [loadKey, setLoadKey] = useState(0);
  const [isApproveOpen, setIsApproveOpen] = useState(false);

  const refresh = useCallback(() => setLoadKey((key) => key + 1), []);
  const validId = PROPOSAL_ID_PATTERN.test(id) && Number.isSafeInteger(Number(id));

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
        if (!proposal || !treasury) {
          setState({
            status: "error",
            message:
              "This proposal does not exist on the configured contract, or the contract is not initialized.",
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

  if (!config.walletSetupComplete || !contractId) {
    return <WalletSetupState />;
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
    return <OverviewSkeleton />;
  }
  if (state.status === "error") {
    return (
      <NotFoundStatus
        title="Proposal not found"
        message={state.message}
        href={APP_ROUTES.proposals}
        hrefLabel="All proposals"
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
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-100">
              <span className="font-mono text-slate-500">#{proposal.id}</span>{" "}
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
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
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
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-100">{displayAmount}</p>
          <p className="mt-1 text-xs text-slate-500">Contract-authoritative amount</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Approval progress
          </p>
          <div className="mt-3">
            <WalletApprovalRail
              approvalCount={proposal.approvalCount}
              threshold={proposal.threshold}
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
              <span className="break-all font-mono text-xs text-slate-300">{proposal.proposer}</span>
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
              <span className="break-all font-mono text-xs text-slate-300">
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
    </div>
  );
}