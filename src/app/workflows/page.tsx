import Link from "next/link";
import { Workflow as WorkflowIcon } from "lucide-react";
import { catalog } from "@/lib/registry";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const workflows = (await catalog()).filter((agent) => agent.category === "workflow");

  return (
    <div className="mx-auto max-w-7xl">
      <p className="text-sm text-ash">Workflows</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold text-bone md:text-4xl">
        Multi-step agents
      </h1>
      <p className="mt-2 max-w-prose text-steel">
        A workflow chains several real-world steps — search, act, verify — toward one outcome, then hands
        you off to finish anything that needs your own login or payment. Paid the same way as any agent:
        one ANVL signature, no gas.
      </p>

      {workflows.length === 0 ? (
        <div className="mt-16 rounded-sm border border-dashed border-brass/30 px-6 py-16 text-center">
          <p className="text-bone">No workflows yet.</p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {workflows.map((workflow) => (
            <li key={workflow.id}>
              <Link
                href={`/workflows/${workflow.id}`}
                className="group relative block min-h-44 rounded-sm bg-iron p-5 pl-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
              >
                <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-ember" />
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-lg font-bold text-bone group-hover:text-ember">
                    {workflow.name}
                  </h2>
                  <WorkflowIcon className="size-5 text-ember" aria-hidden />
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-steel">{workflow.description}</p>
                <p className="mt-4 text-xs text-ash">
                  {workflow.price} ANVL · {workflow.avgResponse}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
