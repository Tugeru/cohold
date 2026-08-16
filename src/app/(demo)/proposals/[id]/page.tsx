import { ProposalRouteView } from "@/components/ProposalRouteView";

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProposalRouteView id={id} />;
}
