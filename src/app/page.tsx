import Link from "next/link";
import { EnvironmentBadge } from "@/components/EnvironmentBadge";
import { coholdConfig } from "@/lib/cohold-config";
import { APP_ROUTES, createTreasuryHref } from "@/lib/app-routes";

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 font-bold">
              C
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-white">Cohold</div>
              <p className="text-[11px] text-slate-400">Shared funds. Shared control.</p>
            </div>
          </div>
          <EnvironmentBadge compact />
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-16">
        <section className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
            Stellar Testnet demo
          </p>
          <h1 className="max-w-xl text-4xl font-bold tracking-tight text-white sm:text-5xl leading-[1.1]">
            Funds leave only when the group signs.
          </h1>
          <p className="max-w-[42ch] text-sm leading-relaxed text-slate-300">
            Cohold is a multi-approval treasury. Members contribute. Proposals wait.
            Execution happens after the threshold, not after one officer decides.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {coholdConfig.modeConfigured && coholdConfig.mode === "demo" ? (
              <Link
                href={APP_ROUTES.overview}
                className="inline-flex items-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500"
              >
                View Demo
              </Link>
            ) : (
              <Link
                href={APP_ROUTES.treasuries}
                className="inline-flex items-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500"
              >
                Open Treasuries
              </Link>
            )}
            {coholdConfig.modeConfigured && coholdConfig.mode === "demo" ? (
              <Link
                href={createTreasuryHref()}
                className="inline-flex items-center rounded-xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:border-slate-500"
              >
                Create Treasury
              </Link>
            ) : (
              <Link
                href={APP_ROUTES.wallet}
                className="inline-flex items-center rounded-xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:border-slate-500"
              >
                Open Wallet
              </Link>
            )}
          </div>
        </section>

        <aside className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Spending rule
          </div>
          <div className="mt-3 font-mono text-5xl font-bold tracking-tight text-emerald-400">
            2 of 3
          </div>
          <p className="mt-3 max-w-[34ch] text-sm text-slate-300">
            The creator has no extra spending power. Amount and recipient stay fixed after a
            proposal is created. Refresh and deep links keep the same treasury or proposal.
          </p>
          <dl className="mt-6 grid gap-3 text-xs text-slate-400">
            <div className="flex items-center justify-between border-t border-slate-800 pt-3">
              <dt>Public landing</dt>
              <dd className="font-mono text-slate-200">no wallet required</dd>
            </div>
            <div className="flex items-center justify-between border-t border-slate-800 pt-3">
              <dt>Demo data</dt>
              <dd className="font-mono text-slate-200">fixture treasuries</dd>
            </div>
          </dl>
        </aside>
      </main>
    </div>
  );
}
