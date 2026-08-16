import { notFound } from "next/navigation";
import { AgentDetail } from "@/components/agent-detail";
import { getCatalogAgent } from "@/lib/registry";

export const dynamic = "force-dynamic";

export default async function AgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ agentId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { agentId } = await params;
  const { tab } = await searchParams;
  const agent = await getCatalogAgent(agentId);
  if (!agent) notFound();

  return (
    <AgentDetail
      agent={agent}
      initialTab={tab === "playground" ? "playground" : "readme"}
    />
  );
}
