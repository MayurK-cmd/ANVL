import type { Metadata } from "next";
import { catalog } from "@/lib/registry";
import { StakePanel } from "@/components/stake-panel";

/** Reads the registry on every request so on-chain state stays current. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stake · Anvil",
  description: "Stake $ANVL on Anvil agents and earn a share of their call revenue.",
};

export default async function StakePage() {
  const agents = await catalog();

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm text-ash">Stake</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold text-bone md:text-4xl">
        Stake on agents
      </h1>
      <p className="mt-2 max-w-prose text-steel">
        Every paid call splits 50% to the agent&apos;s creator, 30% to stakers, 20% to treasury —
        settled atomically in the same transaction as the payment.
      </p>

      <div className="mt-8">
        <StakePanel agents={agents} />
      </div>
    </div>
  );
}
