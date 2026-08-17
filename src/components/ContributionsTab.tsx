"use client";

import React from "react";
import { Treasury } from "@/types";
import { formatAddress, formatAmount, formatDate, timeAgo } from "@/lib/utils";
import { getStellarExpertUrl } from "@/lib/stellar";
import { Coins, ExternalLink, ArrowDownRight, Plus } from "lucide-react";

interface ContributionsTabProps {
  treasury: Treasury;
  onOpenContribute: () => void;
}

export function ContributionsTab({
  treasury,
  onOpenContribute,
}: ContributionsTabProps) {
  const contributions = treasury.contributions || [];

  return (
    <div className="space-y-6">
      {/* Overview stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-sm font-bold text-white">
            Treasury Deposit History
          </h3>
          <p className="text-xs text-slate-400">
            All member asset contributions are locked in the Soroban smart contract.
          </p>
        </div>
        <button
          onClick={onOpenContribute}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Make Deposit</span>
        </button>
      </div>

      {contributions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-10 text-center space-y-3">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-slate-500">
            <Coins className="h-5 w-5" />
          </div>
          <h4 className="text-sm font-semibold text-white">No deposits yet</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Members can fund the treasury by making deposits using Stellar Testnet assets.
          </p>
          <button
            onClick={onOpenContribute}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition"
          >
            <span>Deposit Funds</span>
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-semibold">Contributor</th>
                  <th className="py-3 px-4 font-semibold">Amount</th>
                  <th className="py-3 px-4 font-semibold">Memo / Note</th>
                  <th className="py-3 px-4 font-semibold">Timestamp</th>
                  <th className="py-3 px-4 font-semibold text-right">Stellar Tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-300">
                {contributions.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">
                        {c.memberLabel || formatAddress(c.memberAddress)}
                      </div>
                      <div className="font-mono tabular-nums text-[10px] text-slate-500">
                        {formatAddress(c.memberAddress, 6)}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums font-bold text-emerald-400">
                      +{formatAmount(c.amount, treasury.tokenSymbol)}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {c.note || <span className="text-slate-500">—</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {formatDate(c.createdAt)} ({timeAgo(c.createdAt)})
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      <a
                        href={getStellarExpertUrl("tx", c.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                      >
                        <span>{formatAddress(c.txHash, 4)}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
