import { StoreGridModern } from "@/components/store-grid-modern";
import type { Agent } from "@/data/agents";

export function AgentsMarketplace({ agents }: { agents: Agent[] }) {
  return (
    <div>
      <div className="page-header">
        <p className="eyebrow">Marketplace</p>
        <h1 className="page-title">Browse agents by job, not by chain primitive.</h1>
        <p className="max-w-3xl text-base leading-7 text-copy">
          Price Monitor, Scholar Compare, and other agents surface the useful result first.
          Identity, payment rails, and revenue sharing stay visible without taking over the interface.
        </p>
      </div>
      <StoreGridModern agents={agents} />
    </div>
  );
}
