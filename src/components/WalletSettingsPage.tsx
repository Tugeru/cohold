"use client";

import { DemoGate } from "@/components/DemoGate";
import { WalletSettingsView } from "@/components/WalletSettingsView";
import { useDemoData } from "@/context/DemoDataContext";

export function WalletSettingsPage() {
  const { resetDemo } = useDemoData();

  return (
    <DemoGate>
      <WalletSettingsView onResetDemo={resetDemo} />
    </DemoGate>
  );
}
