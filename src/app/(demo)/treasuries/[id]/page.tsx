import { TreasuryRouteView } from "@/components/TreasuryRouteView";

export default async function TreasuryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TreasuryRouteView id={id} />;
}
