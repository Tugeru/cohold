"use client";

import { useRouter } from "next/navigation";
import { DemoGate } from "@/components/DemoGate";
import { GlobalProposalsView } from "@/components/GlobalProposalsView";
import { useDemoData } from "@/context/DemoDataContext";
import { APP_ROUTES } from "@/lib/app-routes";

export default function ProposalsPage() {
  const router = useRouter();
  const { proposals, treasuries, refresh } = useDemoData();

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
