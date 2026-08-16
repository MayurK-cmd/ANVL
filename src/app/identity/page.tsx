import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { listIdentities } from "@/lib/identity";
import { RegisterIdentity } from "@/components/register-identity";
import { EXPLORER, shortAddr } from "@/lib/format";

/** Reads the chain on every request — never prerender or cache. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Identity · Anvil",
  description: "ERC-8004 identities registered for Anvil agents on Monad Testnet.",
};

export default async function IdentityPage() {
  const identities = await listIdentities();
  const identityRegistry = process.env.NEXT_PUBLIC_IDENTITY_REGISTRY;
  const reputationRegistry = process.env.NEXT_PUBLIC_REPUTATION_REGISTRY;

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm text-ash">Identity</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold text-bone md:text-4xl">
        ERC-8004 identities
      </h1>
      <p className="mt-2 max-w-prose text-steel">
        A public, on-chain registry of agent identities on Monad Testnet — the testnet stand-in
        for the canonical ERC-8004 registries (env vars swap at mainnet cutover, nothing else
        changes).
      </p>

      <div className="mt-8">
        <RegisterIdentity />
      </div>

      <section className="mt-6 rounded-sm bg-iron p-6">
        <h2 className="font-display text-xl font-bold text-bone">Registered identities</h2>
        {identities.length === 0 ? (
          <p className="mt-3 text-steel">No identities registered yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-ash">
                  <th className="pb-2 pr-4 font-normal">Token</th>
                  <th className="pb-2 pr-4 font-normal">Agent</th>
                  <th className="pb-2 pr-4 font-normal">Owner</th>
                  <th className="pb-2 font-normal">URI</th>
                </tr>
              </thead>
              <tbody>
                {identities.map((rec) => (
                  <tr key={rec.tokenId} id={`token-${rec.tokenId}`} className="border-t border-brass/10">
                    <td className="py-2 pr-4 font-mono text-bone">#{rec.tokenId}</td>
                    <td className="py-2 pr-4 text-bone">{rec.agentName ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <a
                        href={`${EXPLORER}/address/${rec.owner}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 font-mono text-ash hover:text-bone"
                      >
                        {shortAddr(rec.owner)}
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    </td>
                    <td className="max-w-xs truncate py-2 text-steel">{rec.tokenURI ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-sm bg-iron p-4 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-ash">IdentityRegistry</span>
          {identityRegistry ? (
            <a
              href={`${EXPLORER}/address/${identityRegistry}`}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 font-mono text-bone hover:text-brass"
            >
              {shortAddr(identityRegistry)}
              <ExternalLink className="size-3" aria-hidden />
            </a>
          ) : (
            <span className="text-ash">not configured</span>
          )}
        </div>
        <div className="mt-2 flex justify-between gap-4">
          <span className="text-ash">ReputationRegistry</span>
          {reputationRegistry ? (
            <a
              href={`${EXPLORER}/address/${reputationRegistry}`}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 font-mono text-bone hover:text-brass"
            >
              {shortAddr(reputationRegistry)}
              <ExternalLink className="size-3" aria-hidden />
            </a>
          ) : (
            <span className="text-ash">not configured</span>
          )}
        </div>
      </section>
    </div>
  );
}
