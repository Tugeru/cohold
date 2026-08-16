"use client";

import React from "react";
import { OverviewSkeleton } from "@/components/Skeletons";
import { ResourceStatus } from "@/components/ResourceStatus";
import { WalletSetupState } from "@/components/WalletSetupState";
import { useDemoData } from "@/context/DemoDataContext";

export function DemoGate({ children }: { children: React.ReactNode }) {
  const { canMutate, loading, error, treasuries, retry } = useDemoData();

  if (!canMutate) {
    return <WalletSetupState />;
  }

  if (loading && treasuries.length === 0) {
    return <OverviewSkeleton />;
  }

  if (error && treasuries.length === 0) {
    return (
      <ResourceStatus
        title="Failed to load shared treasuries"
        message={error}
        onRetry={retry}
      />
    );
  }

  return <>{children}</>;
}
