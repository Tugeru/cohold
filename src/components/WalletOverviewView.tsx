"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  type ChainProposalView,
  type ChainTreasuryView,
  loadWalletProposalViews,
  loadWalletTreasury,
  stellarCoholdRpc,
} from "@/lib/contract-adapter";
import { coholdConfig, configuredRpcUrl } from "@/lib/cohold-config";
import { ensureFactoryTreasuryDiscovery } from "@/lib/treasury-discovery";
import { walletTreasuryContractIds } from "@/lib/treasury-registry";
import { formatBaseAmount } from "@/lib/money";
import {
  buildWalletOverview,
  memberSlicesOnly,
  type WalletOverviewData,
} from "@/lib/wallet-overview";
import { APP_ROUTES, walletProposalHref } from "@/lib/app-routes";
import { timeAgo } from "@/lib/utils";
import { useWallet } from "@/context/WalletContext";
import { useWalletResourceGate } from "@/components/WalletSetupState";
import { OverviewSkeleton } from "@/components/Skeletons";
import { WalletCreateTreasuryDialog } from "@/components/WalletCreateTreasuryDialog";
import { WalletApprovalRail } from "@/components/WalletChainStatus";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Coins,
  PlusCircle,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

type OverviewState =
  | { status: "loading" }
  | { status: "ready"; data: WalletOverviewData }
  | { status: "error"; message: string };

function treasuryBalanceLabel(view: ChainTreasuryView): string {
  if (view.balance === null) return "Unavailable";
  if (view.tokenSymbol === null || view.tokenDecimals === null) {
    return `${view.balance} base units`;
  }
  return formatBaseAmount(view.balance, view.tokenDecimals, view.tokenSymbol);
}

function proposalAmountLabel(proposal: ChainProposalView): string {
  if (proposal.tokenSymbol === null || proposal.tokenDecimals === null) {
    return `${proposal.amount} base units`;
  }
  return formatBaseAmount(proposal.amount, proposal.tokenDecimals, proposal.tokenSymbol);
}

/**
 * Wallet-mode dashboard at /overview. Reads the wallet's treasuries (where
 * it is a member — created ones included, since the contract locks the
 * creator in as a member) and their proposals from chain, then renders the
 * same KPI and action surfaces as the demo overview — approve, execute, add
 * funds, and create-proposal all open from the treasury/proposal routes
 * this view links to. Read failures degrade to labeled tiles; they never
 * fabricate balances.
 */
export function WalletOverviewView() {
  const config = coholdConfig;
  const [contractIds, setContractIds] = useState(() =>
    walletTreasuryContractIds(config),
  );
  const { freighterAddress } = useWallet();
  const walletGate = useWalletResourceGate();
  const rpc = useMemo(() => stellarCoholdRpc(), []);
  const [state, setState] = useState<OverviewState>({ status: "loading" });
  const [loadKey, setLoadKey] = useState(0);
  const [isCreateTreasuryOpen, setIsCreateTreasuryOpen] = useState(false);

  const refresh = useCallback(() => setLoadKey((key) => key + 1), []);

  // Factory-created treasuries appear after one discovery read; the load
  // effect below re-runs because contractIds is part of its deps.
  useEffect(() => {
    let cancelled = false;
    void ensureFactoryTreasuryDiscovery(
      config,
      freighterAddress,
      configuredRpcUrl(config),
    ).then(() => {
      if (!cancelled) setContractIds(walletTreasuryContractIds(config));
    });
    return () => {
      cancelled = true;
    };
  }, [config, freighterAddress]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (contractIds.length === 0) {
        setState({
          status: "ready",
          data: buildWalletOverview({ walletAddress: null, slices: [] }),
        });
        return;
      }
      setState({ status: "loading" });
      const slices = await Promise.all(
        contractIds.map(async (contractId) => {
          try {
            const treasury = await loadWalletTreasury(rpc, contractId);
            if (!treasury) {
              return {
                contractId,
                treasury: null,
                treasuryError:
                  "The configured contract is not initialized or is not a Cohold treasury on this network.",
                proposals: [],
                proposalsError: null,
              };
            }
            try {
              const proposals = await loadWalletProposalViews(
                rpc,
                contractId,
                freighterAddress ?? null,
              );
              return {
                contractId,
                treasury,
                treasuryError: null,
                proposals,
                proposalsError: null,
              };
            } catch (error) {
              return {
                contractId,
                treasury,
                treasuryError: null,
                proposals: [],
                proposalsError:
                  error instanceof Error
                    ? error.message
                    : "Proposals could not be read from chain.",
              };
            }
          } catch (error) {
            return {
              contractId,
              treasury: null,
              treasuryError:
                error instanceof Error ? error.message : "Treasury could not be read from chain.",
              proposals: [],
              proposalsError: null,
            };
          }
        }),
      );
      if (cancelled) return;
      setState({
        status: "ready",
        data: buildWalletOverview({
          slices: memberSlicesOnly(slices, freighterAddress),
          walletAddress: freighterAddress?.toUpperCase() ?? null,
        }),
      });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [rpc, contractIds, freighterAddress, loadKey]);

  if (walletGate) {
    return walletGate;
  }
  if (state.status === "loading") {
    return <OverviewSkeleton />;
  }
  if (state.status === "error") {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-red-400" />
          <div>
            <h3 className="font-semibold text-red-300">Overview unavailable on chain</h3>
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
    );
  }

  const { data } = state;
  const treasuryById = new Map(
    data.treasuries.map((t) => [t.contractId, t] as const),
  );
  const treasuryName = (contractId: string): string =>
    treasuryById.get(contractId)?.name ?? "Shared Treasury";
  const totalLabel =
    data.totalTokenSymbol !== null && data.totalTokenDecimals !== null
      ? formatBaseAmount(data.totalBalanceBaseUnits, data.totalTokenDecimals, data.totalTokenSymbol)
      : `${data.totalBalanceBaseUnits.toLocaleString("en-US")} base units`;
  const walletLabel = freighterAddress
    ? `${freighterAddress.slice(0, 6)}…${freighterAddress.slice(-4)}`
    : null;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 p-5 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300 border border-emerald-500/20">
              <Sparkles className="h-3 w-3" />
              <span>
                Active Signer:{" "}
                {walletLabel ? (
                  <span className="font-mono tabular-nums">{walletLabel}</span>
                ) : (
                  "Connect Freighter to see your approval status"
                )}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Shared Treasury Overview
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Balances, members, and proposals read from your Cohold treasuries on Stellar
              Testnet. Approvals and curation happen on-chain — never through this page alone.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => setIsCreateTreasuryOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-600 shadow-md shadow-emerald-700/30 transition"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create Treasury</span>
            </button>
            <button
              onClick={refresh}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-750 transition"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh from chain</span>
            </button>
          </div>
        </div>
      </div>

      {/* Failure tiles: never hide healthy treasuries behind a broken one */}
      {data.failedTreasuries.length > 0 && (
        <div className="space-y-2">
          {data.failedTreasuries.map((failure) => (
            <div
              key={failure.contractId}
              className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-red-400" />
                <div>
                  <h3 className="text-xs font-semibold text-red-300">
                    Treasury unavailable on chain
                  </h3>
                  <p className="mt-0.5 font-mono tabular-nums text-[11px] text-slate-500">
                    {failure.contractId}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{failure.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {data.failedProposals.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-xs font-semibold text-amber-300">
            Proposals could not be read for{" "}
            {data.failedProposals.length === 1 ? "one treasury" : `${data.failedProposals.length} treasuries`}
            {" "}— their rows are omitted below.
          </p>
          <p className="mt-1 text-[11px] text-slate-400">{data.failedProposals[0].message}</p>
        </div>
      )}

      {/* Primary KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Treasury Funds</span>
            <Coins className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-white tracking-tight">
            {totalLabel}
          </div>
          <div className="text-[11px] text-emerald-400 font-medium">
            On Stellar Testnet · from chain
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Active Treasuries</span>
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-white tracking-tight">
            {data.treasuries.length}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Governed by Soroban Contracts
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/10 p-5 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-amber-300">
            <span>Needs My Approval</span>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-amber-300 tracking-tight">
            {data.needsMyApproval.length}
          </div>
          <div className="text-[11px] text-amber-400/80 font-medium">
            Awaiting your signature
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/10 p-5 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-emerald-300">
            <span>Ready to Disburse</span>
            <Zap className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-emerald-300 tracking-tight">
            {data.readyToDisburse.length}
          </div>
          <div className="text-[11px] text-emerald-400/80 font-medium">
            Quorum threshold achieved
          </div>
        </div>
      </div>

      {data.treasuries.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-10 text-center space-y-3">
          <Coins className="h-8 w-8 text-slate-600 mx-auto" />
          <h2 className="text-base font-bold text-white">You are not in any treasury yet</h2>
          <p className="mx-auto max-w-md text-xs leading-relaxed text-slate-400">
            Create a treasury to get started — it deploys a real Cohold contract on Stellar
            Testnet from your wallet in a few signatures. Your wallet is locked in as a member,
            so the treasury appears here immediately.
          </p>
          <button
            onClick={() => setIsCreateTreasuryOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-emerald-950 hover:bg-emerald-400 transition"
          >
            <PlusCircle className="h-4 w-4" />
            Create Treasury
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: needs my approval + treasuries */}
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-400" />
                  <h2 className="text-sm sm:text-base font-bold text-white">
                    Needs My Approval ({data.needsMyApproval.length})
                  </h2>
                </div>
                <a
                  href={APP_ROUTES.proposals}
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                >
                  <span>View all proposals</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>

              {data.needsMyApproval.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-center text-xs text-slate-400 space-y-1">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto" />
                  <div className="font-semibold text-slate-200">You&apos;re all caught up!</div>
                  <div>No proposals currently need your signature.</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.needsMyApproval.slice(0, 3).map((proposal) => (
                    <a
                      key={`${proposal.treasuryId}:${proposal.id}`}
                      href={walletProposalHref(String(proposal.id), proposal.treasuryId)}
                      className="block rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 hover:border-amber-500/50 transition space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                        <div className="min-w-0">
                          <span className="text-[11px] font-semibold text-emerald-400">
                            {treasuryName(proposal.treasuryId)}
                          </span>
                          <h3 className="text-sm font-bold text-white mt-0.5 truncate">
                            <span className="font-mono tabular-nums text-slate-500">
                              #{proposal.id}
                            </span>{" "}
                            {proposal.description}
                          </h3>
                        </div>
                        <div className="text-left sm:text-right">
                          <div className="text-base font-bold font-mono tabular-nums text-emerald-400">
                            {proposalAmountLabel(proposal)}
                          </div>
                          <div className="text-[11px] text-amber-400 font-medium">
                            {proposal.approvalCount} of {proposal.threshold} Approvals
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                        <span className="truncate">
                          Recipient: {proposal.recipient.slice(0, 10)}…
                        </span>
                        <span className="text-emerald-400 font-semibold flex items-center gap-1 shrink-0">
                          <span>Review &amp; Sign</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                      <WalletApprovalRail
                        approvalCount={proposal.approvalCount}
                        threshold={proposal.threshold}
                      />
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <h2 className="text-sm sm:text-base font-bold text-white">
                    Active Shared Treasuries ({data.treasuries.length})
                  </h2>
                </div>
                <a
                  href={APP_ROUTES.treasuries}
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                >
                  <span>View all treasuries</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.treasuries.slice(0, 4).map((treasury) => (
                  <a
                    key={treasury.contractId}
                    href={APP_ROUTES.treasury(treasury.contractId)}
                    className="group block rounded-2xl border border-slate-800 bg-slate-900/80 p-4 hover:border-emerald-500/50 transition space-y-2"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-300">
                        {treasury.threshold} of {treasury.memberCount} Rule
                      </span>
                      <span className="font-mono tabular-nums text-emerald-400 font-bold">
                        {treasuryBalanceLabel(treasury)}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition mt-1">
                      {treasury.name}
                    </h3>
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {treasury.members.length > 0
                          ? `${treasury.members.length} members`
                          : `${treasury.memberCount} members (unverified list)`}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-emerald-400 transition transform group-hover:translate-x-1" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Right: approved + recently disbursed */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Ready to Disburse</h3>
                </div>
                <span className="text-[11px] text-slate-400">
                  {data.readyToDisburse.length} Approved
                </span>
              </div>

              {data.readyToDisburse.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No proposals have reached quorum yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.readyToDisburse.slice(0, 5).map((proposal) => (
                    <a
                      key={`${proposal.treasuryId}:${proposal.id}`}
                      href={walletProposalHref(String(proposal.id), proposal.treasuryId)}
                      className="block rounded-xl border border-emerald-500/25 bg-emerald-950/10 p-3 text-xs hover:border-emerald-500/50 transition"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white truncate min-w-0">
                          <span className="font-mono tabular-nums text-slate-500">#{proposal.id}</span>{" "}
                          {proposal.description}
                        </span>
                        <span className="font-mono tabular-nums font-bold text-emerald-400 shrink-0">
                          {proposalAmountLabel(proposal)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="truncate">
                          To: {proposal.recipient.slice(0, 10)}… · {treasuryName(proposal.treasuryId)}
                        </span>
                        <span className="text-emerald-400 font-semibold flex items-center gap-1 shrink-0">
                          Execute <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Recently Executed</h3>
                </div>
                <span className="text-[11px] text-slate-400">
                  {data.recentlyExecuted.length} Completed
                </span>
              </div>

              {data.recentlyExecuted.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No payments executed yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.recentlyExecuted.map((proposal) => (
                    <a
                      key={`${proposal.treasuryId}:${proposal.id}`}
                      href={walletProposalHref(String(proposal.id), proposal.treasuryId)}
                      className="block rounded-xl border border-slate-800/80 bg-slate-950 p-3 text-xs space-y-1 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white truncate min-w-0">
                          {proposal.description}
                        </span>
                        <span className="font-mono tabular-nums font-bold text-emerald-400 shrink-0">
                          {proposalAmountLabel(proposal)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="truncate">To: {proposal.recipient.slice(0, 10)}…</span>
                        <span>{timeAgo(new Date(proposal.createdAt * 1000))}</span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-5 space-y-3 text-xs">
              <div className="flex items-center gap-2 font-bold text-emerald-300">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Core Cohold Thesis</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                &ldquo;Shared money should require shared permission.&rdquo; Funds can leave a
                treasury only when a cryptographic quorum of members explicitly signs the
                proposal.
              </p>
              <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between text-[11px] text-slate-400">
                <span>Smart Contract Custody</span>
                <span className="text-emerald-400 font-semibold">100% On-Chain Rules</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {isCreateTreasuryOpen && (
        <WalletCreateTreasuryDialog
          onClose={(createdTreasuryId) => {
            setIsCreateTreasuryOpen(false);
            if (createdTreasuryId) refresh();
          }}
        />
      )}
    </div>
  );
}