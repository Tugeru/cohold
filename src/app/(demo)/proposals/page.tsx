"use client";

import { DemoGate } from "@/components/DemoGate";
import { GlobalProposalsView } from "@/components/GlobalProposalsView";
import { WalletProposalsList } from "@/components/WalletProposalsList";
import { useDemoData } from "@/context/DemoDataContext";
import { coholdConfig } from "@/lib/cohold-config";

export default function ProposalsPage() {
  const { proposals, treasuries, refresh } = useDemoData();

  if (coholdConfig.mode === "wallet") {
    return <WalletProposalsList />;
  }

  return (
    <DemoGate>
      <GlobalProposalsView
        proposals={proposals}
        treasuries={treasuries}
        onRefresh={() => {
          void refresh();
        }}
      />
    </DemoGate>
  );
}
