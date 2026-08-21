import { type ReactNode } from "react";
import { DemoShell } from "@/components/DemoShell";
import { DemoDataProvider } from "@/context/DemoDataContext";
import { coholdConfig, isDemoMutationAllowed } from "@/lib/cohold-config";
import { getDemoProposals, getDemoTreasuries } from "@/lib/demo-queries";

export default async function DemoLayout({ children }: { children: ReactNode }) {
  // ponytail: RSC seed so demo nav has no client waterfall. Wallet mode skips the DB read.
  const canPrefetch = isDemoMutationAllowed(coholdConfig);
  const [treasuries, proposals] = canPrefetch
    ? await Promise.all([getDemoTreasuries(), getDemoProposals()])
    : [[], [] as Awaited<ReturnType<typeof getDemoProposals>>];
  return (
    <DemoDataProvider initialTreasuries={treasuries as never} initialProposals={proposals as never}>
      <DemoShell>{children}</DemoShell>
    </DemoDataProvider>
  );
}
