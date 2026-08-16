"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  type ChainProposalView,
  loadWalletProposalViews,
  stellarCoholdRpc,
} from "@/lib/contract-adapter";
import { coholdConfig } from "@/lib/cohold-config";
import { formatBaseAmount } from "@/lib/money";
import { APP_ROUTES, walletProposalHref } from "@/lib/app-routes";
import { useWallet } from "@/context/WalletContext";
import { WalletSetupState } from "@/components/WalletSetupState";
import { OverviewSkeleton } from "@/components/Skeletons";
import {
  WalletApprovalRail,
  WalletApprovalChip,
  WalletStatusChip,
} from "@/components/WalletChainStatus";
import { RefreshCw, AlertTriangle } from "lucide-react";

export function WalletProposalsList() {
  const config = coholdConfig;
  const contractId = config.contractId ?? null;
  const { freighterAddress } = useWallet();
  const rpc = useMemo(() => stellarCoholdRpc(), []);
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ready"; proposals: ChainProposalView[] }
    | { status: "error"; message: string }
  >({ status: "loading" });
  const [loadKey, setLoadKey] = useState(0);

  const refresh = useCallback(() => setLoadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!contractId) return;
      setState({ status: "loading" });
      try {
        const proposals = await loadWalletProposalViews(
          rpc,
          contractId,
          freighterAddress ?? null,
        );
        if (cancelled) return;
        setState({ status: "ready", proposals });
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
  }, [rpc, contractId, freighterAddress, loadKey]);

  if (!config.walletSetupComplete || !contractId) {
    return <WalletSetupState />;
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
            <h3 className="font-semibold text-red-300">Proposals unavailable on chain</h3>
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

  const { proposals } = state;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Proposals</h1>
          <p className="mt-1 text-sm text-slate-400">
            Read-only proposal list for the configured treasury{" "}
            <span className="font-mono text-slate-500">{contractId.slice(0, 10)}…</span> on
            Stellar Testnet.
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

      {proposals.length > 0 ? (
        <ul className="space-y-3">
          {proposals.map((proposal) => (
            <li key={proposal.id}>
              <a
                href={walletProposalHref(String(proposal.id), contractId)}
                className="block rounded-2xl border border-slate-800 bg-slate-900/80 p-5 transition hover:border-slate-700"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-100">
                      <span className="font-mono text-slate-500">#{proposal.id}</span>{" "}
                      {proposal.description}
                    </p>
                    <p className="mt-1 font-mono text-xs text-slate-400">
                      {proposal.tokenSymbol
                        ? formatBaseAmount(
                            proposal.amount,
                            proposal.tokenDecimals ?? 7,
                            proposal.tokenSymbol,
                          )
                        : `${proposal.amount} base units`}{" "}
                      → {proposal.recipient.slice(0, 14)}…
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
                <div className="mt-4">
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
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center">
          <p className="text-sm text-slate-400">No proposals yet on this contract.</p>
        </div>
      )}
    </div>
  );
}