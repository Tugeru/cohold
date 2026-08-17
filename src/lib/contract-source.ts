import { useCallback, useEffect, useState } from "react";

export async function fetchContractSource(): Promise<string> {
  const res = await fetch("/api/contract-source", { cache: "no-store" });
  const body = (await res.json()) as {
    success?: boolean;
    source?: string;
    error?: string;
  };
  if (!res.ok || !body.success || typeof body.source !== "string") {
    throw new Error(body.error || "Failed to load contract source");
  }
  return body.source;
}

/** Lazy-fetch the crate's lib.rs once, when `active` first becomes true. */
export function useContractSource(active: boolean) {
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active || source !== null || error !== null) return;
    let cancelled = false;
    fetchContractSource()
      .then((src) => {
        if (!cancelled) setSource(src);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load contract source"
          );
      });
    return () => {
      cancelled = true;
    };
  }, [active, source, error]);

  const retry = useCallback(() => setError(null), []);

  return { source, error, retry };
}