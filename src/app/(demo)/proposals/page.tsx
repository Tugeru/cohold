"use client";

import { useRouter } from "next/navigation";
import { DemoGate } from "@/components/DemoGate";
import { GlobalProposalsView } from "@/components/GlobalProposalsView";
import { WalletProposalsList } from "@/components/WalletProposalsList";
import { useDemoData } from "@/context/DemoDataContext";
import { coholdConfig } from "@/lib/cohold-config";
import { APP_ROUTES } from "@/lib/app-routes";

export default function ProposalsPage() {
  const router = useRouter();
  const { proposals, treasuries, refresh } = useDemoData();

  if (coholdConfig.mode === "wallet") {
    return <WalletProposalsList />;
  }

  return (
    <DemoGate>
      <GlobalProposalsView
        proposals={proposals}
        treasuries={treasuries}
        onSelectTreasury={(id) => router.push(APP_ROUTES.treasury(id))}
        onRefresh={() => {
          void refresh();
        }}
      />
    </DemoGate>
  );
}
