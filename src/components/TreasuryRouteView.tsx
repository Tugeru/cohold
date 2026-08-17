"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TreasuryDetail } from "@/components/TreasuryDetail";
import { DetailSkeleton } from "@/components/Skeletons";
import { NotFoundStatus, ResourceStatus } from "@/components/ResourceStatus";
import { WalletSetupState } from "@/components/WalletSetupState";
import { useDemoData } from "@/context/DemoDataContext";
import { coholdConfig } from "@/lib/cohold-config";
import { WalletTreasuryView } from "@/components/WalletTreasuryView";
import { APP_ROUTES } from "@/lib/app-routes";
import { resourceStateFromResponse, type ResourceState } from "@/lib/resource-state";
import { Treasury } from "@/types";

export function TreasuryRouteView({ id }: { id: string }) {
  const router = useRouter();
  const { canMutate, refresh, refreshToken } = useDemoData();
  const [state, setState] = useState<ResourceState<Treasury> | { status: "loading" }>({
    status: "loading",
  });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch(`/api/treasuries/${id}`);
      const body = (await res.json()) as Record<string, unknown>;
      setState(
        resourceStateFromResponse(res, body, (payload) =>
          payload.success === true && payload.treasury && typeof payload.treasury === "object"
            ? (payload.treasury as Treasury)
            : undefined,
        ),
      );
    } catch (err: unknown) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to load treasury",
      });
    }
  }, [id]);

  useEffect(() => {
    if (!canMutate) return;
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canMutate, load, refreshToken]);

  if (coholdConfig.mode === "wallet") {
    return <WalletTreasuryView id={id} />;
  }

  if (!canMutate) {
    return <WalletSetupState />;
  }

  if (state.status === "loading") {
    return <DetailSkeleton />;
  }
  if (state.status === "not_found") {
    return (
      <NotFoundStatus
        title="Treasury not found"
        message="This treasury id is not in the demo dataset. Check the URL or return to the list."
        href={APP_ROUTES.treasuries}
        hrefLabel="Back to treasuries"
      />
    );
  }

  if (state.status === "error") {
    return (
      <ResourceStatus
        title="Failed to load treasury"
        message={state.message}
        onRetry={() => {
          void load();
        }}
      />
    );
  }

  return (
    <TreasuryDetail
      treasury={state.data}
      onBack={() => router.push(APP_ROUTES.treasuries)}
      onRefresh={() => {
        void refresh();
        void load();
      }}
    />
  );
}
