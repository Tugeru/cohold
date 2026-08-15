import React from "react";

export function TreasuryCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-5 w-24 rounded-md bg-slate-800" />
        <div className="h-5 w-20 rounded-full bg-slate-800" />
      </div>
      <div className="space-y-2">
        <div className="h-6 w-3/4 rounded-md bg-slate-800" />
        <div className="h-4 w-full rounded-md bg-slate-800/60" />
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 flex justify-between">
        <div className="space-y-1">
          <div className="h-3 w-16 bg-slate-800 rounded" />
          <div className="h-6 w-24 bg-slate-800 rounded" />
        </div>
        <div className="space-y-1">
          <div className="h-3 w-16 bg-slate-800 rounded" />
          <div className="h-5 w-16 bg-slate-800 rounded" />
        </div>
      </div>
    </div>
  );
}

export function ProposalCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-5 w-32 rounded-full bg-slate-800" />
        <div className="h-6 w-24 rounded-md bg-slate-800" />
      </div>
      <div className="space-y-2">
        <div className="h-5 w-2/3 rounded bg-slate-800" />
        <div className="h-4 w-full rounded bg-slate-800/60" />
      </div>
      <div className="h-2.5 w-full rounded-full bg-slate-800" />
      <div className="flex gap-2">
        <div className="h-6 w-20 rounded bg-slate-800" />
        <div className="h-6 w-20 rounded bg-slate-800" />
      </div>
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2"
          >
            <div className="h-4 w-28 bg-slate-800 rounded" />
            <div className="h-8 w-36 bg-slate-800 rounded" />
            <div className="h-3 w-20 bg-slate-800/60 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-6 w-48 bg-slate-800 rounded" />
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <ProposalCardSkeleton key={i} />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-6 w-36 bg-slate-800 rounded" />
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 w-full bg-slate-800 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
