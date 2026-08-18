"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { coholdConfig, configuredRpcUrl } from "@/lib/cohold-config";
import { ensureFactoryTreasuryDiscovery } from "@/lib/treasury-discovery";
import { walletTreasuryContractIds } from "@/lib/treasury-registry";
import {
  loadWalletActivity,
  stellarCoholdRpc,
  type ChainActivityType,
  type ChainActivityView,
  type ChainTreasuryView,
} from "@/lib/contract-adapter";
import { formatBaseAmount } from "@/lib/money";
import { walletExplorerUrl } from "@/lib/app-routes";
import { useWallet } from "@/context/WalletContext";
import { WalletSetupState, useWalletResourceGate } from "@/components/WalletSetupState";
import { ActivitySkeleton } from "@/components/Skeletons";
import { formatAddress, formatDate, timeAgo } from "@/lib/utils";
import {
  History,
  Coins,
  Send,
  CheckCircle2,
  BadgeCheck,
  Receipt,
  ShieldCheck,
  ExternalLink,
  Filter,
  RefreshCw,
  AlertTriangle,
  Info,
} from "lucide-react";

type ActivityFilter =
  | "all"
  | "contributions"
  | "proposals"
  | "approvals"
  | "payments";

const FILTERS: { key: ActivityFilter; label: string }[] = [
  { key: "all", label: "All Activity" },
  { key: "contributions", label: "Deposits" },
  { key: "proposals", label: "Proposals" },
  { key: "approvals", label: "Approvals" },
  { key: "payments", label: "Payments" },
];

const ACTION_META: Record<
  ChainActivityType,
  { label: string; tone: string; icon: React.ReactNode }
> = {
  "treasury-created": {
    label: "Treasury created",
    tone: "border-purple-500/30 bg-purple-500/10 text-purple-300",
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
  },
  deposit: {
    label: "Deposit contributed",
    tone: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    icon: <Coins className="h-3.5 w-3.5" />,
  },
  "proposal-created": {
    label: "Proposal created",
    tone: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
    icon: <Send className="h-3.5 w-3.5" />,
  },
  "approval-signed": {
    label: "Approval signed",
    tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  "proposal-approved": {
    label: "Approval threshold met",
    tone: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    icon: <BadgeCheck className="h-3.5 w-3.5" />,
  },
  "payment-paid": {
    label: "Payment executed",
    tone: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
    icon: <Receipt className="h-3.5 w-3.5" />,
  },
};

function matchesFilter(type: ChainActivityType, filter: ActivityFilter): boolean {
  switch (filter) {
    case "contributions":
      return type === "deposit";
    case "proposals":
      return type === "proposal-created";
    case "approvals":
      return type === "approval-signed" || type === "proposal-approved";
    case "payments":
      return type === "payment-paid";
    default:
      return true;
  }
}

interface TreasuryGroup {
  contractId: string;
  treasury: ChainTreasuryView | null;
  events: ChainActivityView[];
}

type ActivityState =
  | { status: "loading" }
  | { status: "ready"; groups: TreasuryGroup[]; partialFailures: string[] }
  | { status: "error"; message: string };

export function WalletActivityView() {
  const config = coholdConfig;
  const walletGate = useWalletResourceGate();
  const { freighterAddress } = useWallet();
  const rpc = useMemo(() => stellarCoholdRpc(), []);
  const [state, setState] = useState<ActivityState>({ status: "loading" });
  const [loadKey, setLoadKey] = useState(0);
  const [filter, setFilter] = useState<ActivityFilter>("all");

  const refresh = useCallback(() => setLoadKey((key) => key + 1), []);
  const [contractIds, setContractIds] = useState(() =>
    walletTreasuryContractIds(config),
  );

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
        setState({ status: "ready", groups: [], partialFailures: [] });
        return;
      }
      setState({ status: "loading" });
      const results = await Promise.allSettled(
        contractIds.map(async (contractId) => {
          const { treasury, events } = await loadWalletActivity(rpc, contractId);
          return { contractId, treasury, events };
        }),
      );
      if (cancelled) return;
      const groups: TreasuryGroup[] = [];
      const partialFailures: string[] = [];
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          groups.push(result.value);
        } else {
          partialFailures.push(contractIds[index]);
        }
      });
      if (groups.length === 0) {
        const reason = results[0].status === "rejected"
          ? results[0].reason instanceof Error
            ? results[0].reason.message
            : "The Testnet RPC could not be reached."
          : "No configured treasury could be read.";
        setState({ status: "error", message: reason });
        return;
      }
      setState({ status: "ready", groups, partialFailures });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [rpc, contractIds, loadKey]);

  if (walletGate || contractIds.length === 0) {
    return walletGate ?? <WalletSetupState />;
  }
  if (state.status === "loading") {
    return <ActivitySkeleton />;
  }
  if (state.status === "error") {
    return (
      <div className="space-y-6">
        <Header onRefresh={refresh} />
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-red-400" />
            <div>
              <h3 className="font-semibold text-red-300">Activity unavailable</h3>
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

  const events = state.groups.flatMap((group) =>
    group.events.map((event) => ({
      event,
      treasury: group.treasury,
    })),
  );
  events.sort((a, b) => b.event.createdAt.localeCompare(a.event.createdAt));
  const visibleEvents = events
    .filter(({ event }) => matchesFilter(event.type, filter))
    .slice(0, 100);

  return (
    <div className="space-y-6">
      <Header onRefresh={refresh} />

      <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-4 text-xs text-slate-300 flex items-start gap-2.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
        <p>
          These rows are confirmed Soroban contract events read from Stellar
          Testnet. They cover only the recent RPC retention window (~7 days of
          ledgers) — this is a recent activity list, not a full audit.
          Deeper history would need an indexer such as StellarExpert.
        </p>
      </div>

      {state.groups.length > 1 && (
        <p className="text-[11px] text-slate-500">
          Reading from {state.groups.length} configured treasuries
          {state.partialFailures.length > 0
            ? ` — ${state.partialFailures.length} could not be read and are omitted`
            : ""}
          .
        </p>
      )}

      {/* Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <Filter className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`shrink-0 rounded-xl px-3 py-1.5 font-semibold transition border ${
              filter === key
                ? "bg-slate-800 text-white border-slate-700"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {visibleEvents.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-950/40 p-12 text-center text-xs text-slate-400">
          No recent activity matches this filter. The contract emits an event
          for every treasury action, but only events inside the RPC retention
          window are listed here.
        </div>
      ) : (
        <ul className="space-y-3">
          {visibleEvents.map(({ event, treasury }) => (
            <ActivityRow key={event.id} event={event} treasury={treasury} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Header({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
          Activity
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Confirmed treasury activity from the Soroban contract on Stellar
          Testnet.
        </p>
      </div>
      <button
        onClick={onRefresh}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Refresh from chain
      </button>
    </div>
  );
}

function ActivityRow({
  event,
  treasury,
}: {
  event: ChainActivityView;
  treasury: ChainTreasuryView | null;
}) {
  const meta = ACTION_META[event.type];
  const amount =
    event.amountBaseUnits !== undefined && treasury?.tokenSymbol
      ? formatBaseAmount(
          event.amountBaseUnits,
          treasury.tokenDecimals ?? 7,
          treasury.tokenSymbol,
        )
      : event.amountBaseUnits !== undefined
        ? `${event.amountBaseUnits.toLocaleString("en-US")} base units`
        : null;
  const address = event.actor ?? event.recipient;
  const addressLabel = event.type === "payment-paid" ? "to" : "by";

  return (
    <li className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 space-y-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${meta.tone}`}
          >
            {meta.icon}
            {meta.label}
          </span>
          {treasury && (
            <span className="text-xs font-semibold text-slate-200">
              {treasury.name}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
            Confirmed on Testnet
          </span>
        </div>
        <span className="text-[11px] text-slate-400">
          {timeAgo(event.createdAt)} · {formatDate(event.createdAt)} · ledger{" "}
          {event.ledger}
        </span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
        {address && (
          <span className="text-slate-300">
            {addressLabel}{" "}
            <a
              href={walletExplorerUrl("account", address)}
              target="_blank"
              rel="noreferrer"
              className="font-mono tabular-nums text-cyan-400 hover:text-cyan-300"
            >
              {formatAddress(address, 8)}
            </a>
          </span>
        )}
        {amount !== null && (
          <span className="font-mono tabular-nums font-semibold  text-slate-100">
            {amount}
          </span>
        )}
        {event.proposalId !== undefined && (
          <span className="text-slate-500">proposal #{event.proposalId}</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-800/80 pt-2 text-[11px] text-slate-400 font-mono tabular-nums">
        <span className="min-w-0 truncate">
          Tx: {formatAddress(event.txHash, 8)}
        </span>
        <a
          href={walletExplorerUrl("tx", event.txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-cyan-400 hover:text-cyan-300"
        >
          <span>View Explorer</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </li>
  );
}