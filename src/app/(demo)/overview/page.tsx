"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DemoGate } from "@/components/DemoGate";
import { OverviewView } from "@/components/OverviewView";
import { WalletOverviewView } from "@/components/WalletOverviewView";
import { OverviewSkeleton } from "@/components/Skeletons";
import { useDemoData } from "@/context/DemoDataContext";
import { coholdConfig } from "@/lib/cohold-config";
import { APP_ROUTES, shouldOpenCreateTreasury } from "@/lib/app-routes";

function OverviewPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    treasuries,
    proposals,
    canMutate,
    openCreateTreasury,
    openDemoTour,
    setCreateTreasuryOpen,
  } = useDemoData();

  useEffect(() => {
    if (!canMutate) return;
    if (!shouldOpenCreateTreasury(searchParams.get("create"))) return;
    setCreateTreasuryOpen(true);
    router.replace(APP_ROUTES.overview);
  }, [canMutate, router, searchParams, setCreateTreasuryOpen]);

  if (coholdConfig.mode === "wallet") {
    return <WalletOverviewView />;
  }

  return (
    <DemoGate>
      <OverviewView
        treasuries={treasuries}
        proposals={proposals}
        onSelectTreasury={(id) => router.push(APP_ROUTES.treasury(id))}
        onCreateTreasury={openCreateTreasury}
        onOpenDemoTour={openDemoTour}
        onNavigateToProposals={() => router.push(APP_ROUTES.proposals)}
        onNavigateToTreasuries={() => router.push(APP_ROUTES.treasuries)}
      />
    </DemoGate>
  );
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <OverviewPageInner />
    </Suspense>
  );
}
