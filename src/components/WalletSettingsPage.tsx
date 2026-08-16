"use client";

import { WalletSettingsView } from "@/components/WalletSettingsView";
import { useDemoData } from "@/context/DemoDataContext";

export function WalletSettingsPage() {
  const { resetDemo } = useDemoData();

  return <WalletSettingsView onResetDemo={resetDemo} />;
}
