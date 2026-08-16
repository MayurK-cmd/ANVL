import { StoreGrid } from "@/components/store-grid";
import { catalog } from "@/lib/registry";

/** Reads the registry on every request so `anvil deploy` shows up on refresh. */
export const dynamic = "force-dynamic";

export default async function StorePage() {
  // Workflows (multi-step, chained agents) have their own section — keep the
  // Store grid to single-call agents.
  const agents = (await catalog()).filter((agent) => agent.category !== "workflow");

  return (
    <div className="mx-auto max-w-7xl">
      <p className="text-sm text-ash">Store</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold text-bone md:text-4xl">
        Explore AI agents
      </h1>
      <StoreGrid agents={agents} />
    </div>
  );
}
