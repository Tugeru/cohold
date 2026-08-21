"use client";

import { DemoGate } from "@/components/DemoGate";
import { TreasuryList } from "@/components/TreasuryList";
import { WalletTreasuriesList } from "@/components/WalletTreasuriesList";
import { useDemoData } from "@/context/DemoDataContext";
import { coholdConfig } from "@/lib/cohold-config";

export default function TreasuriesPage() {
  const { treasuries, openCreateTreasury, openDemoTour } = useDemoData();

  if (coholdConfig.mode === "wallet") {
    return <WalletTreasuriesList />;
  }

  return (
    <DemoGate>
      <TreasuryList
        treasuries={treasuries}
        onCreateTreasury={openCreateTreasury}
        onOpenDemoTour={openDemoTour}
      />
    </DemoGate>
  );
}
