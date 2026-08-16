import { AgentsMarketplace } from "@/components/agents-marketplace";
import { catalog } from "@/lib/registry";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const agents = (await catalog()).filter((agent) => agent.category !== "workflow");

  return <AgentsMarketplace agents={agents} />;
}
