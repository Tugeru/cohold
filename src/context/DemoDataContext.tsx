"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Proposal, Treasury } from "@/types";
import { coholdConfig, isStateChangingAllowed } from "@/lib/cohold-config";

export type DemoProposal = Proposal & { treasury?: Partial<Treasury> };

interface DemoDataValue {
  treasuries: Treasury[];
  proposals: DemoProposal[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  retry: () => void;
  refreshToken: number;
  canMutate: boolean;
  openCreateTreasury: () => void;
  openDemoTour: () => void;
  openContractModal: () => void;
  setCreateTreasuryOpen: (open: boolean) => void;
  setDemoTourOpen: (open: boolean) => void;
  setContractModalOpen: (open: boolean) => void;
  isCreateTreasuryOpen: boolean;
  isDemoTourOpen: boolean;
  isContractModalOpen: boolean;
  resetDemo: () => Promise<void>;
}

const DemoDataContext = createContext<DemoDataValue | null>(null);

export function DemoDataProvider({ children }: { children: React.ReactNode }) {
  const canMutate = isStateChangingAllowed(coholdConfig);
  const [treasuries, setTreasuries] = useState<Treasury[]>([]);
  const [proposals, setProposals] = useState<DemoProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [isCreateTreasuryOpen, setCreateTreasuryOpen] = useState(false);
  const [isDemoTourOpen, setDemoTourOpen] = useState(false);
  const [isContractModalOpen, setContractModalOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const [tRes, pRes] = await Promise.all([
        fetch("/api/treasuries"),
        fetch("/api/proposals"),
      ]);
      const tData = await tRes.json();
      const pData = await pRes.json();

      if (tData.success) {
        setTreasuries(tData.treasuries || []);
        setError(null);
      } else {
        setError(tData.error || "Failed to load treasuries");
      }
      if (pData.success) {
        setProposals(pData.proposals || []);
      }
      setRefreshToken((token) => token + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load data";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canMutate) return;
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canMutate, refresh]);

  const retry = useCallback(() => {
    setError(null);
    void refresh();
  }, [refresh]);

  const resetDemo = useCallback(async () => {
    try {
      const res = await fetch("/api/stellar/reset-demo", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        await refresh();
      }
    } catch {
      // ignore
    }
  }, [refresh]);

  return (
    <DemoDataContext.Provider
      value={{
        treasuries,
        proposals,
        loading,
        error,
        refresh,
        retry,
        refreshToken,
        canMutate,
        openCreateTreasury: () => setCreateTreasuryOpen(true),
        openDemoTour: () => setDemoTourOpen(true),
        openContractModal: () => setContractModalOpen(true),
        setCreateTreasuryOpen,
        setDemoTourOpen,
        setContractModalOpen,
        isCreateTreasuryOpen,
        isDemoTourOpen,
        isContractModalOpen,
        resetDemo,
      }}
    >
      {children}
    </DemoDataContext.Provider>
  );
}

export function useDemoData() {
  const context = useContext(DemoDataContext);
  if (!context) {
    throw new Error("useDemoData must be used within DemoDataProvider");
  }
  return context;
}
