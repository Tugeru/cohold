"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  type ChainTreasuryView,
  isWalletMemberOfTreasury,
  loadWalletTreasury,
  stellarCoholdRpc,
} from "@/lib/contract-adapter";
import { coholdConfig, configuredRpcUrl } from "@/lib/cohold-config";
import { ensureFactoryTreasuryDiscovery } from "@/lib/treasury-discovery";
import { walletTreasuryContractIds } from "@/lib/treasury-registry";
import { formatBaseAmount } from "@/lib/money";
import { createTreasuryHref, walletExplorerUrl } from "@/lib/app-routes";
import { useWallet } from "@/context/WalletContext";
import { useWalletResourceGate } from "@/components/WalletSetupState";
import { TreasuryCardSkeleton } from "@/components/Skeletons";
import { ShieldCheck, Users, Coins, RefreshCw, AlertTriangle } from "lucide-react";

type ListItem =
  | { status: "loading" }
  | { status: "ready"; view: ChainTreasuryView }
  | { status: "error"; message: string };

function TreasuryCard({
  item,
  walletAddress,
  onRefresh,
}: {
  item: ListItem;
  walletAddress: string | null;
  onRefresh: () => void;
}) {
  if (item.status === "loading") {
    return <TreasuryCardSkeleton />;
  }
  if (item.status === "error") {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-red-400" />
          <div>
            <h3 className="font-semibold text-red-300">Treasury unavailable on chain</h3>
            <p className="mt-1 text-sm text-slate-400">{item.message}</p>
            <button
              onClick={onRefresh}
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
  const view = item.view;
  return (
    <a
      href={`/treasuries/${view.contractId}`}
      className="group rounded-2xl border border-slate-800 bg-slate-900/80 p-6 transition hover:border-emerald-500/40 hover:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">{view.name}</h3>
          <p className="mt-1 font-mono tabular-nums text-xs text-slate-500">{view.contractId}</p>
        </div>
        <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
          Testnet · chain
        </span>
      </div>
      {walletAddress &&
        view.creator.toUpperCase() === walletAddress.toUpperCase() && (
          <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
            <ShieldCheck className="h-3 w-3" /> You created this treasury
          </p>
        )}
      <div className="mt-5 grid grid-cols-3 gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Balance</p>
          <p className="mt-1 font-mono tabular-nums text-xl font-semibold text-slate-100">
            {view.balance === null
              ? "Unavailable"
              : view.tokenSymbol
                ? formatBaseAmount(view.balance, view.tokenDecimals ?? 7, view.tokenSymbol)
                : `${view.balance} base units`}
          </p>
          {view.balance === null && (
            <p className="text-[11px] text-amber-400/80">balance read failed</p>
          )}
        </div>
        <div>
          <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            <ShieldCheck className="h-3 w-3" /> Governance
          </p>
          <p className="mt-1 font-mono tabular-nums text-xl font-semibold text-slate-100">
            {view.threshold}
            <span className="text-sm text-slate-500"> / {view.memberCount} members</span>
          </p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            <Users className="h-3 w-3" /> Members
          </p>
          <p className="mt-1 font-mono tabular-nums text-xl font-semibold text-slate-100">
            {view.membersAuthoritative ? view.memberCount : view.members.length}
            {!view.membersAuthoritative && (
              <span className="text-sm text-amber-400/80"> · unverified</span>
            )}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Coins className="h-3.5 w-3.5" />
          {view.tokenSymbol ?? view.tokenAddress.slice(0, 8)}…
        </span>
        <span>Custody: {view.creator.slice(0, 12)}…</span>
      </div>
    </a>
  );
}

export function WalletTreasuriesList() {
  const config = coholdConfig;
  const [contractIds, setContractIds] = useState(() =>
    walletTreasuryContractIds(config),
  );
  const { freighterAddress } = useWallet();
  const walletGate = useWalletResourceGate();
  const rpc = useMemo(() => stellarCoholdRpc(), []);
  const [items, setItems] = useState<Record<string, ListItem>>(() =>
    Object.fromEntries(contractIds.map((id) => [id, { status: "loading" as const }])),
  );
  const [loadKey, setLoadKey] = useState(0);

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

  // Newly discovered factory treasuries start as loading rows; the load
  // effect below fills them in.
  useEffect(() => {
    setItems((prev) => {
      const missing = contractIds.filter((id) => !(id in prev));
      if (missing.length === 0) return prev;
      const seeded = { ...prev };
      for (const id of missing) seeded[id] = { status: "loading" as const };
      return seeded;
    });
  }, [contractIds]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      contractIds.map(async (id) => {
        try {
          const view = await loadWalletTreasury(rpc, id);
          if (cancelled) return;
          setItems((prev) => ({
            ...prev,
            [id]: view
              ? { status: "ready", view }
              : {
                  status: "error",
                  message:
                    "The configured contract is not initialized or is not a Cohold treasury on this network.",
                },
          }));
        } catch (error) {
          if (cancelled) return;
          setItems((prev) => ({
            ...prev,
            [id]: {
              status: "error",
              message:
                error instanceof Error ? error.message : "Failed to read contract state.",
            },
          }));
        }
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [rpc, contractIds, loadKey]);

  const memberIds = useMemo(() => {
    if (!freighterAddress) return new Set<string>();
    const ids = new Set<string>();
    for (const [id, item] of Object.entries(items)) {
      if (item.status === "ready" && isWalletMemberOfTreasury(item.view, freighterAddress)) {
        ids.add(id);
      }
    }
    return ids;
  }, [items, freighterAddress]);

  if (walletGate) {
    return walletGate;
  }

  const visibleIds = contractIds.filter(
    (id) => memberIds.has(id) || items[id]?.status === "error",
  );
  const isMemberOfAny = memberIds.size > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Treasuries</h1>
          <p className="mt-1 text-sm text-slate-400">
            Your treasuries on Stellar Testnet — created by you or where you are a member.
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

      {freighterAddress && !isMemberOfAny && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center">
          <h2 className="text-lg font-semibold text-slate-100">No treasuries yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            You are not a member of any treasury on Testnet yet. Create one — it deploys a real
            contract from your wallet in a few signatures.
          </p>
          <a
            href={createTreasuryHref()}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
          >
            Create a treasury
          </a>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {visibleIds.map((id) => (
          <TreasuryCard
            key={id}
            item={items[id] ?? { status: "loading" }}
            walletAddress={freighterAddress}
            onRefresh={refresh}
          />
        ))}
      </div>

      {freighterAddress && (
        <p className="text-xs text-slate-500">
          Shows treasuries you are a member of (including ones you created), read from the chain
          with your wallet ({freighterAddress.slice(0, 10)}…).
        </p>
      )}
      <div className="text-xs text-slate-600">
        <a
          href={walletExplorerUrl("contract", contractIds[0] ?? "")}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-slate-700 hover:text-slate-400"
        >
          View contract on Stellar Expert
        </a>
      </div>
    </div>
  );
}