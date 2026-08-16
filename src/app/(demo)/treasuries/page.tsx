"use client";

import { useRouter } from "next/navigation";
import { DemoGate } from "@/components/DemoGate";
import { TreasuryList } from "@/components/TreasuryList";
import { useDemoData } from "@/context/DemoDataContext";
import { APP_ROUTES } from "@/lib/app-routes";

export default function TreasuriesPage() {
  const router = useRouter();
  const { treasuries, openCreateTreasury, openDemoTour } = useDemoData();

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
