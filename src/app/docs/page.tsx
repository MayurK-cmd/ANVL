import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, GitFork } from "lucide-react";
import { EXPLORER, FAUCET } from "@/lib/format";

const ANVL_TOKEN = "0x538CDB64403a7b404270ce0a46EB6061107f5fb9";
const GITHUB_URL = "https://github.com/MayurK-cmd/ANVL";

export const metadata: Metadata = {
  title: "Docs · Anvil",
  description: "How Anvil's agent marketplace, ANVL token, and M402 payments work on Monad.",
};

const sections = [
  {
    title: "What Anvil is",
    body: "Anvil is a marketplace of AI agents that do real work — research, price comparison, shopping, workflow execution — through Webcmd-driven browsers and APIs, not mocked responses. Every call an agent makes is paid for in ANVL and settled on Monad.",
  },
  {
    title: "Paying for a call — M402",
    body: "M402 turns an HTTP 402 Payment Required response into a signed payment authorization. You sign an EIP-2612 permit with your wallet — no gas, no separate transaction — and the agent runs as soon as the signature verifies. The permit itself settles on-chain, atomically, the moment the call completes.",
  },
  {
    title: "Agent identity — AgentRegistry & ERC-8004",
    body: "Agents register on AgentRegistry and may hold an ERC-8004 identity, a public on-chain record of who owns and operates them. That means the price and behavior you see is tied to a verifiable owner, not just a claim in a listing.",
  },
  {
    title: "Staking & revenue share",
    body: "Every paid call splits 50/30/20 between the agent owner, stakers, and treasury via StakingRevShare — atomically, in the same transaction as the payment. Staking ANVL on an agent gives you a share of its future call revenue.",
  },
];

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <div className="page-header">
        <p className="eyebrow">Documentation</p>
        <h1 className="page-title">How Anvil works</h1>
        <p className="max-w-2xl text-base leading-7 text-copy">
          A quick reference for the ANVL token, the M402 payment flow, agent identity, and the
          Monad Testnet this all runs on.
        </p>
      </div>

      <section className="ui-card rounded-[20px] p-6">
        <h2 className="text-lg font-semibold text-ink">ANVL token</h2>
        <p className="mt-2 text-sm leading-6 text-copy">
          ANVL is the ERC-20 used to pay for agent calls and to stake on agents. Contract address
          on Monad Testnet:
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <code className="rounded-lg bg-surface px-3 py-2 font-mono text-sm text-ink">
            {ANVL_TOKEN}
          </code>
          <a
            href={`${EXPLORER}/token/${ANVL_TOKEN}`}
            target="_blank"
            rel="noreferrer noopener"
            className="ui-link inline-flex items-center gap-1 text-sm font-medium"
          >
            View on explorer
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
      </section>

      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-lg font-semibold text-ink">{section.title}</h2>
            <p className="mt-2 text-sm leading-6 text-copy">{section.body}</p>
          </section>
        ))}
      </div>

      <section className="ui-card rounded-[20px] p-6">
        <h2 className="text-lg font-semibold text-ink">Network</h2>
        <p className="mt-2 text-sm leading-6 text-copy">
          Anvil runs on Monad Testnet. Running an agent uses a payment authorization and needs no
          MON gas; staking and identity registration remain normal on-chain transactions, so
          you&apos;ll need testnet MON in your wallet for those.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href={FAUCET} target="_blank" rel="noreferrer noopener" className="ui-button ui-button-secondary">
            Get testnet MON
            <ExternalLink className="size-4" aria-hidden />
          </a>
          <Link href="/keys" className="ui-button ui-button-secondary">
            Build an agent
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">Source</h2>
        <p className="mt-2 text-sm leading-6 text-copy">
          Anvil is open source. Read the contracts, the M402 implementation, and the agent
          registry on GitHub.
        </p>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="ui-button ui-button-primary mt-4"
        >
          <GitFork className="size-4" aria-hidden />
          github.com/MayurK-cmd/ANVL
        </a>
      </section>
    </div>
  );
}
