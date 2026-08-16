"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Bot, Search, ShieldCheck, ShoppingBag, Workflow } from "lucide-react";
import { filterAgents, type Agent, type AgentType } from "@/data/agents";

const filters: { id: "all" | AgentType; label: string }[] = [
  { id: "all", label: "All agents" },
  { id: "api", label: "API agents" },
  { id: "browser", label: "Browser agents" },
  { id: "sitemap", label: "Sitemaps" },
];

function iconFor(agent: Agent) {
  if (agent.category === "workflow") return Workflow;
  if (agent.tags.some((tag) => /shop|price/i.test(tag))) return ShoppingBag;
  if (agent.tags.some((tag) => /research|academic/i.test(tag))) return Search;
  return Bot;
}

function AgentCard({ agent }: { agent: Agent }) {
  const Icon = iconFor(agent);
  const verified = agent.identityTokenId != null;

  return (
    <Link
      href={agent.category === "workflow" ? `/workflows/${agent.id}` : `/store/${agent.id}`}
      className="ui-card group flex h-full flex-col rounded-[18px] p-5 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[var(--shadow-lift)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-light text-primary">
            <Icon className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-ink">{agent.name}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`ui-pill ${verified ? "ui-pill-success" : ""}`}>
                {verified ? (
                  <>
                    <ShieldCheck className="size-3.5" aria-hidden />
                    ERC-8004 #{agent.identityTokenId}
                  </>
                ) : (
                  "Unverified identity"
                )}
              </span>
              {agent.category === "workflow" ? <span className="ui-pill ui-pill-primary">Workflow</span> : null}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-copy">{agent.description}</p>

      <ul className="mt-5 flex flex-wrap gap-2">
        {agent.tags.slice(0, 4).map((tag) => (
          <li key={tag} className="ui-pill">
            {tag}
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-6">
        <div className="ui-divider mb-4" />
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary-dark">{agent.price.toFixed(2)} ANVL / {agent.category === "workflow" ? "workflow" : "call"}</p>
            <p className="mt-1 text-xs text-muted">{agent.avgResponse} · {agent.staked} ANVL staked</p>
          </div>
          <span className="ui-button ui-button-secondary min-w-25">
            {agent.category === "workflow" ? "Open flow" : "Run"}
            <ArrowRight className="size-4" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function StoreGridModern({ agents }: { agents: Agent[] }) {
  const [type, setType] = useState<(typeof filters)[number]["id"]>("all");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => filterAgents(query, type, agents), [query, type, agents]);

  return (
    <section className="mt-10">
      <div className="ui-card-muted rounded-[24px] p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => {
              const active = type === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setType(item.id)}
                  className={`ui-button ${active ? "ui-button-primary" : "ui-button-secondary"}`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <label className="relative block w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <span className="sr-only">Search agents</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search scholar, price, zepto..."
              className="ui-input pl-10"
            />
          </label>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="ui-card mt-6 rounded-[22px] px-6 py-16 text-center">
          <p className="text-base font-semibold text-ink">No agents match that search.</p>
          <p className="mt-2 text-sm text-copy">Try a broader term or switch the agent type filter.</p>
          <button
            type="button"
            onClick={() => {
              setType("all");
              setQuery("");
            }}
            className="ui-button ui-button-secondary mt-5"
          >
            Show all agents
          </button>
        </div>
      ) : (
        <ul className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((agent) => (
            <li key={agent.id} className="h-full">
              <AgentCard agent={agent} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
