"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { NotFoundStatus, ResourceStatus } from "@/components/ResourceStatus";
import { DetailSkeleton } from "@/components/Skeletons";
import { WalletSetupState } from "@/components/WalletSetupState";
import { useDemoData } from "@/context/DemoDataContext";
import { useWallet } from "@/context/WalletContext";
import { coholdConfig } from "@/lib/cohold-config";
import { WalletProposalView } from "@/components/WalletProposalView";
import { APP_ROUTES } from "@/lib/app-routes";
import { resourceStateFromResponse, type ResourceState } from "@/lib/resource-state";
import { formatAddress, formatAmount, formatDate } from "@/lib/utils";
import { Proposal, Treasury } from "@/types";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";

type ProposalRecord = Proposal & { treasury?: Partial<Treasury> };

export function ProposalRouteView({ id }: { id: string }) {
  const { activePersona } = useWallet();
  const { canMutate, refreshToken } = useDemoData();
  const [state, setState] = useState<ResourceState<ProposalRecord> | { status: "loading" }>({
    status: "loading",
  });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch(`/api/proposals/${id}`);
      const body = (await res.json()) as Record<string, unknown>;
      setState(
        resourceStateFromResponse(res, body, (payload) =>
          payload.success === true && payload.proposal && typeof payload.proposal === "object"
            ? (payload.proposal as ProposalRecord)
            : undefined,
        ),
      );
    } catch (err: unknown) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to load proposal",
      });
    }
  }, [id]);

  useEffect(() => {
    if (!canMutate) return;
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canMutate, load, refreshToken]);

  if (coholdConfig.mode === "wallet") {
    return <WalletProposalView id={id} />;
  }

  if (!canMutate) {
    return <WalletSetupState />;
  }

  if (state.status === "loading") {
    return <DetailSkeleton />;
  }
  if (state.status === "not_found") {
    return (
      <NotFoundStatus
        title="Proposal not found"
        message="This proposal id is not in the demo dataset. Check the URL or return to the list."
        href={APP_ROUTES.proposals}
        hrefLabel="Back to proposals"
      />
    );
  }

  if (state.status === "error") {
    return (
      <ResourceStatus
        title="Failed to load proposal"
        message={state.message}
        onRetry={() => {
          void load();
        }}
      />
    );
  }

  const proposal = state.data;
  const token = proposal.treasury?.tokenSymbol || "DEMO";
  const myApproval = proposal.approvals?.find(
    (approval) =>
      approval.approverAddress.toUpperCase() === activePersona?.address.toUpperCase(),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Link
          href={APP_ROUTES.proposals}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition shrink-0"
          title="Back to all proposals"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-400">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>{proposal.treasury?.name || "Shared Treasury"}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">
            {proposal.title}
          </h1>
          <p className="text-xs text-slate-400 mt-1">{proposal.description}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] text-slate-400">Amount</div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
                {formatAmount(proposal.amount, token)}
              </div>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                Demo data
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Fixture amount — displayed for the demo; no Testnet transaction.
            </p>
          </div>
          <div className="text-xs text-slate-400 space-y-1">
            <div>
              Status:{" "}
              <span className="font-semibold text-white uppercase">{proposal.status}</span>
            </div>
            <div>
              Approval rule:{" "}
              <span className="font-semibold text-slate-200">
                {proposal.threshold} approvals required
              </span>
            </div>
            <div>
              Current approvals:{" "}
              <span className="font-semibold tabular-nums text-slate-200">
                {proposal.approvalCount} of {proposal.threshold}
              </span>
            </div>
            {proposal.approvals && activePersona && (
              <div>
                Your approval:{" "}
                {myApproval ? (
                  <span className="font-semibold text-emerald-400">
                    Recorded · {activePersona.name}
                  </span>
                ) : (
                  <span className="text-slate-500">
                    Not recorded — you have not signed yet
                  </span>
                )}
              </div>
            )}
            <div>Created {formatDate(proposal.createdAt)}</div>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-3 text-xs text-slate-400 space-y-1">
          <div>
            Recipient: {proposal.recipientLabel || formatAddress(proposal.recipientAddress)}
          </div>
          <div>
            Proposer: {proposal.proposerLabel || formatAddress(proposal.proposerAddress)}
          </div>
        </div>

        <Link
          href={APP_ROUTES.treasury(proposal.treasuryId)}
          className="inline-flex items-center rounded-xl bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
        >
          Open parent treasury
        </Link>
      </div>
    </div>
  );
}
