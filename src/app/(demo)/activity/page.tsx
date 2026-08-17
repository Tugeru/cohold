"use client";

import { DemoGate } from "@/components/DemoGate";
import { GlobalActivityView } from "@/components/GlobalActivityView";
import { WalletActivityView } from "@/components/WalletActivityView";
import { coholdConfig } from "@/lib/cohold-config";

export default function ActivityPage() {
  if (coholdConfig.mode === "wallet") {
    return <WalletActivityView />;
  }

  return (
    <DemoGate>
      <GlobalActivityView />
    </DemoGate>
  );
}
