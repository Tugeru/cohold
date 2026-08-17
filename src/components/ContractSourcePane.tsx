import { Check, Copy } from "lucide-react";

interface ContractSourcePaneProps {
  source: string | null;
  error: string | null;
  copied: boolean;
  onCopy: (source: string) => void;
  onRetry: () => void;
  /** Modal variant: tighter radius and padding than the detail-tab pane. */
  compact?: boolean;
}

/**
 * Three-state display of the crate's lib.rs (loading / error+retry / source
 * with copy), shared by the treasury-detail inspector and the demo modal.
 */
export function ContractSourcePane({
  source,
  error,
  copied,
  onCopy,
  onRetry,
  compact = false,
}: ContractSourcePaneProps) {
  const radius = compact ? "rounded-xl" : "rounded-2xl";
  const copyPad = compact ? "px-2.5 py-1" : "px-3 py-1.5";
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 font-mono tabular-nums">
          contracts/cohold/src/lib.rs (Soroban SDK 27)
        </span>
        {source && (
          <button
            onClick={() => onCopy(source)}
            className={`flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 ${copyPad} text-xs text-slate-200 transition`}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span>{copied ? "Copied" : "Copy Rust Code"}</span>
          </button>
        )}
      </div>
      {source ? (
        <pre
          className={`${radius} border border-slate-800 bg-slate-950 p-4 text-xs font-mono tabular-nums text-cyan-200 overflow-x-auto leading-relaxed${
            compact ? "" : " max-h-[600px]"
          }`}
        >
          {source}
        </pre>
      ) : error ? (
        <div
          className={`${radius} border border-red-900/50 bg-red-950/30 p-4 text-xs text-red-300 space-y-2`}
        >
          <p>Could not load contract source: {error}</p>
          <button
            onClick={onRetry}
            className="rounded bg-red-900/50 hover:bg-red-900/70 px-2.5 py-1 text-[11px] text-red-200 transition"
          >
            Try again
          </button>
        </div>
      ) : (
        <div
          className={`${radius} border border-slate-800 bg-slate-950 p-4 text-xs text-slate-400`}
        >
          Loading contracts/cohold/src/lib.rs…
        </div>
      )}
    </div>
  );
}