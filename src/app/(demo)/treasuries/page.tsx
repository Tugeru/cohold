"use client";

import { useRouter } from "next/navigation";
import { DemoGate } from "@/components/DemoGate";
import { TreasuryList } from "@/components/TreasuryList";
import { WalletTreasuriesList } from "@/components/WalletTreasuriesList";
import { useDemoData } from "@/context/DemoDataContext";
import { coholdConfig } from "@/lib/cohold-config";
import { APP_ROUTES } from "@/lib/app-routes";

export default function TreasuriesPage() {
  const router = useRouter();
  const { treasuries, openCreateTreasury, openDemoTour } = useDemoData();

  if (coholdConfig.mode === "wallet") {
    return <WalletTreasuriesList />;
  }

  return (
    <DemoGate>
      <TreasuryList
        treasuries={treasuries}
        onSelectTreasury={(id) => router.push(APP_ROUTES.treasury(id))}
        onCreateTreasury={openCreateTreasury}
        onOpenDemoTour={openDemoTour}
      />
    </DemoGate>
  );
}
