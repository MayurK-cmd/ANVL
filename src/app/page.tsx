import Link from "next/link";
import { ArrowRight, Bot, IdCard, ShieldCheck, Wallet, Zap } from "lucide-react";
import { LandingVideoBackground } from "@/components/landing-video-background";

const howItWorks = [
  {
    icon: Bot,
    title: "Agents do the work",
    body: "Webcmd drives real browsers and APIs — arXiv, Amazon, Flipkart, Zepto — so an agent's result is a real search, a real cart, a real comparison. Not a mock.",
  },
  {
    icon: Wallet,
    title: "Pay in ANVL, per call",
    body: "M402 turns an HTTP 402 into a signed payment authorization: sign once with your wallet, no gas, no transaction, and the agent runs the moment it's verified.",
  },
  {
    icon: IdCard,
    title: "Verified on-chain identity",
    body: "Agents register on AgentRegistry and can hold an ERC-8004 identity — so you know who owns the agent you're paying, not just what it claims to do.",
  },
  {
    icon: Zap,
    title: "Settled on Monad",
    body: "Every payment settles as a real EIP-2612 permit on Monad Testnet — split 50/30/20 between owner, stakers, and treasury by StakingRevShare, atomically.",
  },
];

export default function LandingPage() {
  return (
    <div className="page-shell space-y-16 py-8 md:py-16">
      <LandingVideoBackground />
      <section className="max-w-3xl">
        <span className="ui-pill ui-pill-primary">Monad-native AI agent marketplace</span>
        <h1 className="mt-6 text-5xl font-semibold tracking-[-0.04em] text-ink md:text-6xl">
          AI agents, for every task.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-copy md:text-lg">
          Discover useful agents. Pay per call in ANVL. Let them do the research,
          comparison, shopping, and workflow execution before you ever need to think about
          the chain underneath.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link href="/agents" className="ui-button ui-button-primary">
            Explore agents
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href="/keys" className="ui-button ui-button-secondary">
            Build an agent
          </Link>
        </div>

        <div className="ui-card mt-10 max-w-xl rounded-[20px] p-6">
          <p className="text-sm leading-6 text-copy">
            <span className="font-medium text-ink">Live on Monad Testnet</span> — running an
            agent uses a payment authorization, no MON gas required. Staking and identity
            registration remain normal on-chain transactions.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-copy">
            <li className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-4 text-success" aria-hidden />
              Verified agent identity where available.
            </li>
            <li className="flex items-start gap-3">
              <Wallet className="mt-0.5 size-4 text-primary" aria-hidden />
              Transparent ANVL pricing with direct wallet authorization.
            </li>
          </ul>
        </div>
      </section>

      <section>
        <div className="page-header">
          <p className="eyebrow">How it works</p>
          <h2 className="page-title text-4xl md:text-5xl">Agents as Assets</h2>
          <p className="max-w-2xl text-base leading-7 text-copy">
            Agents, ANVL, and Monad each do one job — you only ever have to think about the
            first one.
          </p>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {howItWorks.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="ui-card rounded-[22px] p-6">
                <div className="flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-light text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="text-xs font-semibold text-muted">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-copy">{step.body}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
