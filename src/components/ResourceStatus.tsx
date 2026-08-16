import React from "react";

interface ResourceStatusProps {
  title: string;
  message: string;
  onRetry?: () => void;
}

export function ResourceStatus({ title, message, onRetry }: ResourceStatusProps) {
  return (
    <div className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-8 text-center space-y-3">
      <h3 className="text-base font-bold text-rose-300">{title}</h3>
      <p className="text-xs text-slate-400">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function NotFoundStatus({
  title,
  message,
  href,
  hrefLabel,
}: {
  title: string;
  message: string;
  href: string;
  hrefLabel: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-950/40 p-12 text-center space-y-3">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="text-xs text-slate-400 max-w-sm mx-auto">{message}</p>
      <a
        href={href}
        className="inline-flex items-center justify-center rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
      >
        {hrefLabel}
      </a>
    </div>
  );
}
