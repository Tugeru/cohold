import { Suspense } from "react";
import { ProposalRouteView } from "@/components/ProposalRouteView";
import { OverviewSkeleton } from "@/components/Skeletons";

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <ProposalRouteView id={id} />
    </Suspense>
  );
}
