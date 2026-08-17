"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  type ChainProposalView,
  type ChainTreasuryView,
  loadWalletProposalViews,
  loadWalletTreasury,
  stellarCoholdRpc,
} from "@/lib/contract-adapter";
import { coholdConfig, isConfiguredWalletTreasury } from "@/lib/cohold-config";
import { formatBaseAmount } from "@/lib/money";
import { APP_ROUTES, walletExplorerUrl, walletProposalHref } from "@/lib/app-routes";
import { useWallet } from "@/context/WalletContext";
import { useWalletResourceGate } from "@/components/WalletSetupState";
import { NotFoundStatus } from "@/components/ResourceStatus";
import { DetailSkeleton } from "@/components/Skeletons";
import { WalletContributeDialog } from "@/components/WalletContributeDialog";
import { WalletCreateProposalDialog } from "@/components/WalletProposalDialogs";
import {
  WalletApprovalRail,
  WalletApprovalChip,
  WalletStatusChip,
} from "@/components/WalletChainStatus";
import {
  ArrowLeft,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
  Coins,
  ExternalLink,
  AlertTriangle,
  FileSpreadsheet,
} from "lucide-react";

type TreasuryDetailState =
  | { status: "loading" }
  | {
      status: "ready";
      view: ChainTreasuryView;
      proposals:
        | { ok: true; list: ChainProposalView[] }
        | { ok: false; message: string };
    }
  | { status: "error"; message: string };

export function WalletTreasuryView({ id }: { id: string }) {
  const config = coholdConfig;
  const { freighterAddress, canPerformStateChange, walletActionBlockReason } = useWallet();
  const walletGate = useWalletResourceGate();
  const rpc = useMemo(() => stellarCoholdRpc(), []);
  const [state, setState] = useState<TreasuryDetailState>({ status: "loading" });
  const [loadKey, setLoadKey] = useState(0);
  const [isContributeOpen, setIsContributeOpen] = useState(false);
  const [isCreateProposalOpen, setIsCreateProposalOpen] = useState(false);

  const refresh = useCallback(() => setLoadKey((key) => key + 1), []);

  useEffect(() => {
    // Unknown IDs must not trigger chain reads at all.
    if (!isConfiguredWalletTreasury(config, id)) return;
    let cancelled = false;
    async function load() {
      setState({ status: "loading" });
      try {
        const view = await loadWalletTreasury(rpc, id);
        if (cancelled) return;
        if (!view) {
          setState({
            status: "error",
            message:
              "This contract is not initialized or is not a Cohold treasury on Stellar Testnet.",
          });
          return;
        }
        let proposals:
          | { ok: true; list: ChainProposalView[] }
          | { ok: false; message: string };
        try {
          const list = await loadWalletProposalViews(rpc, id, freighterAddress ?? null);
          proposals = { ok: true, list };
        } catch (error) {
          // The treasury itself is readable; keep it visible and surface the
          // proposal-read failure instead of blanking the whole page.
          proposals = {
            ok: false,
            message:
              error instanceof Error ? error.message : "Failed to read proposals from chain.",
          };
        }
        if (cancelled) return;
        setState({ status: "ready", view, proposals });
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
  }, [rpc, id, config, freighterAddress, loadKey]);

  if (walletGate) {
    return walletGate;
  }
  if (!isConfiguredWalletTreasury(config, id)) {
    return (
      <NotFoundStatus
        title="Treasury not found"
        message="This contract is not in the configured wallet treasury list. Only the contract IDs in your environment configuration are available."
        href={APP_ROUTES.treasuries}
        hrefLabel="Back to treasuries"
      />
    );
  }
  if (state.status === "loading") {
    return <DetailSkeleton />;
  }
  if (state.status === "error") {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-red-400" />
            <div>
              <h3 className="font-semibold text-red-300">Treasury unavailable on chain</h3>
              <p className="mt-1 text-sm text-slate-400">{state.message}</p>
              <button
                onClick={refresh}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry from chain
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { view, proposals } = state;
  const walletAddress = freighterAddress?.toUpperCase() ?? null;
  const isMember = Boolean(
    walletAddress && view.membersAuthoritative && view.members.includes(walletAddress),
  );
  const canContribute = isMember && canPerformStateChange;
  const canPropose = isMember && canPerformStateChange;
  const addFundsTooltip = !walletAddress
    ? "Connect Freighter to add funds."
    : !canPerformStateChange
      ? (walletActionBlockReason ?? "Connect Freighter to add funds.")
      : !view.membersAuthoritative
        ? "Member list unavailable — connect Freighter to verify membership."
        : isMember
          ? undefined
          : "Only members can add funds to this treasury.";
  const proposeTooltip = !walletAddress
    ? "Connect Freighter to create proposals."
    : !canPerformStateChange
      ? (walletActionBlockReason ?? "Connect Freighter to create proposals.")
      : !view.membersAuthoritative
        ? "Member list unavailable — connect Freighter to verify membership."
        : isMember
          ? undefined
          : "Only members can create proposals in this treasury.";
  const balanceLabel =
    view.balance === null
      ? "Unavailable"
      : view.tokenSymbol
        ? formatBaseAmount(view.balance, view.tokenDecimals ?? 7, view.tokenSymbol)
        : `${view.balance} base units`;

  return (
    <div className="space-y-6">
      <a
        href={APP_ROUTES.treasuries}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All treasuries
      </a>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-100">{view.name}</h1>
            <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
              Testnet · chain
            </span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 font-mono tabular-nums text-xs text-slate-500">
            {view.contractId}
            <a
              href={walletExplorerUrl("contract", view.contractId)}
              target="_blank"
              rel="noreferrer"
              className="text-slate-600 hover:text-slate-300"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCreateProposalOpen(true)}
            disabled={!canPropose}
            title={proposeTooltip}
            aria-disabled={!canPropose}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-500"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            New proposal
          </button>
          <button
            onClick={() => setIsContributeOpen(true)}
            disabled={!canContribute}
            title={addFundsTooltip}
            aria-disabled={!canContribute}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Add funds
          </button>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh from chain
          </button>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            <Coins className="h-3 w-3" /> Balance
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="font-mono tabular-nums text-2xl font-semibold text-slate-100">
              {balanceLabel}
            </p>
            {view.balance !== null && (
              <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                Testnet · chain
              </span>
            )}
          </div>
          <p className="mt-1 font-mono tabular-nums text-xs text-slate-500">
            {view.balance === null
              ? "balance read failed"
              : `${view.tokenSymbol ?? "token"} · ${view.tokenAddress.slice(0, 12)}…`}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            <ShieldCheck className="h-3 w-3" /> Governance threshold
          </p>
          <p className="mt-2 font-mono tabular-nums text-2xl font-semibold text-slate-100">
            {view.threshold}
            <span className="text-base text-slate-500"> / {view.memberCount} members</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">Approvals required to execute</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            <Users className="h-3 w-3" /> Creator
          </p>
          <p className="mt-2 break-all font-mono tabular-nums text-xs text-slate-300">{view.creator}</p>
          <a
            href={walletExplorerUrl("account", view.creator)}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
          >
            View account <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
        <h2 className="text-sm font-semibold text-slate-200">Members</h2>
        <p className="mt-1 text-xs text-slate-500">
          {view.membersAuthoritative
            ? "Member list read from the contract."
            : "Member list could not be read from the contract; only the on-chain member count is authoritative."}
        </p>
        {view.members.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {view.members.map((address) => (
              <li
                key={address}
                className="flex items-center justify-between gap-3 rounded-lg bg-slate-950/60 px-3 py-2"
              >
                <span className="font-mono tabular-nums text-xs text-slate-300">{address}</span>
                {walletAddress === address && (
                  <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                    You
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : view.membersAuthoritative ? (
          <p className="mt-3 text-sm text-slate-500">No members on this contract.</p>
        ) : (
          <p className="mt-3 text-sm text-amber-400/80">
            Member addresses unavailable — connect Freighter to check your membership.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <FileSpreadsheet className="h-4 w-4 text-slate-400" /> Proposals
        </h2>
        {proposals.ok === false ? (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="text-sm text-amber-300">Proposals could not be read from chain.</p>
            <p className="mt-1 text-xs text-slate-400">{proposals.message}</p>
            <button
              onClick={refresh}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry from chain
            </button>
          </div>
        ) : proposals.list.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {proposals.list.map((proposal) => (
              <li key={proposal.id}>
                <a
                  href={walletProposalHref(String(proposal.id), view.contractId)}
                  className="block rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-slate-700"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-200">
                        <span className="font-mono tabular-nums text-slate-500">#{proposal.id}</span>{" "}
                        {proposal.description}
                      </p>
                      <p className="mt-1 font-mono tabular-nums text-xs  text-slate-400">
                        {proposal.tokenSymbol
                          ? formatBaseAmount(
                              proposal.amount,
                              proposal.tokenDecimals ?? 7,
                              proposal.tokenSymbol,
                            )
                          : `${proposal.amount} base units`}{" "}
                        → {proposal.recipient.slice(0, 10)}…
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <WalletStatusChip status={proposal.status} />
                      <WalletApprovalChip
                        state={proposal.currentUserApproval}
                        walletConnected={Boolean(freighterAddress)}
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <WalletApprovalRail
                      approvalCount={proposal.approvalCount}
                      threshold={proposal.threshold}
                    />
                  </div>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No proposals yet on this contract.</p>
        )}
      </div>

      {isContributeOpen && (
        <WalletContributeDialog
          treasury={view}
          rpc={rpc}
          onClose={() => setIsContributeOpen(false)}
          onConfirmed={refresh}
        />
      )}
      {isCreateProposalOpen && (
        <WalletCreateProposalDialog
          treasury={view}
          rpc={rpc}
          onClose={() => setIsCreateProposalOpen(false)}
          onConfirmed={refresh}
        />
      )}
    </div>
  );
}