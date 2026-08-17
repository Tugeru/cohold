import { coholdConfig, getEnvironmentLabel } from "@/lib/cohold-config";

interface EnvironmentBadgeProps {
  compact?: boolean;
}

export function EnvironmentBadge({ compact = false }: EnvironmentBadgeProps) {
  const isDemo = coholdConfig.mode === "demo";
  const isModeConfigured = coholdConfig.modeConfigured;
  const isReady = coholdConfig.walletSetupComplete;

  return (
    <div
      role="status"
      aria-label={getEnvironmentLabel()}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
        !isModeConfigured
          ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
          : isDemo
          ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
          : isReady
          ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
          : "border-rose-500/40 bg-rose-500/10 text-rose-300"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          !isModeConfigured
            ? "bg-rose-400"
            : isDemo
            ? "bg-amber-400"
            : isReady
            ? "bg-cyan-400"
            : "bg-rose-400"
        }`}
      />
      <span>{compact && isDemo ? "Demo" : getEnvironmentLabel()}</span>
      {isModeConfigured && !isDemo && !isReady && <span>· Setup required</span>}
    </div>
  );
}
