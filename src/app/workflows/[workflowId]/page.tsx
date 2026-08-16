import { notFound } from "next/navigation";
import { WorkflowDetail } from "@/components/workflow-detail";
import { getCatalogAgent } from "@/lib/registry";

export const dynamic = "force-dynamic";

export default async function WorkflowPage({
  params,
}: {
  params: Promise<{ workflowId: string }>;
}) {
  const { workflowId } = await params;
  const agent = await getCatalogAgent(workflowId);
  if (!agent || agent.category !== "workflow") notFound();

  return <WorkflowDetail agent={agent} />;
}
