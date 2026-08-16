"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CircleDollarSign, Globe, Terminal } from "lucide-react";
import { filterAgents, type Agent, type AgentType } from "@/data/agents";

const filters: { id: "all" | AgentType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "api", label: "API Agents" },
  { id: "browser", label: "Browser Agents" },
  { id: "sitemap", label: "Sitemaps" },
];

function TypeIcon({ type }: { type: AgentType }) {
  if (type === "browser") {
    return <Globe className="size-5 text-ember" aria-label="Browser agent" />;
  }
  return <Terminal className="size-5 text-brass" aria-label="API agent" />;
}

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Link
      href={`/store/${agent.id}`}
      className="group relative block min-h-44 rounded-sm bg-iron p-5 pl-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
    >
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-[3px] ${
          agent.type === "browser" ? "bg-ember" : "bg-brass"
        }`}
      />
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-bone group-hover:text-ember">
          {agent.name}
        </h2>
        <TypeIcon type={agent.type} />
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-steel">
        {agent.description}
      </p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {agent.tags.slice(0, 5).map((tag) => (
          <li
            key={tag}
            className="rounded-full border border-brass/25 px-2 py-0.5 text-xs text-ash"
          >
            {tag}
          </li>
        ))}
      </ul>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-ash">
        <CircleDollarSign className="size-3.5" aria-hidden />
        {agent.staked} ANVL staked
      </p>
    </Link>
  );
}

export function StoreGrid({ agents }: { agents: Agent[] }) {
  const [type, setType] = useState<(typeof filters)[number]["id"]>("all");
  const [query, setQuery] = useState("");
  const visible = useMemo(
    () => filterAgents(query, type, agents),
    [query, type, agents],
  );

  return (
    <>
      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="radiogroup"
          aria-label="Filter by agent type"
          className="flex flex-wrap gap-2"
        >
          {filters.map((item) => {
            const selected = type === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setType(item.id)}
                className={`min-h-10 rounded-sm px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${
                  selected
                    ? "bg-ember text-soot"
                    : "border border-brass/30 text-steel hover:border-brass"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="w-full lg:max-w-sm">
          <label htmlFor="agent-search" className="sr-only">
            Search agents
          </label>
          <input
            id="agent-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="scholar, price, echo"
            className="min-h-10 w-full rounded-sm border border-brass/30 bg-slag px-3 text-sm text-bone placeholder:text-ash/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="mt-16 rounded-sm border border-dashed border-brass/30 px-6 py-16 text-center">
          <p className="text-bone">No agents match that filter.</p>
          <p className="mt-2 text-sm text-ash">
            {type === "sitemap"
              ? "No sitemaps listed yet. Try API or browser agents."
              : "Clear search or switch the type filter."}
          </p>
          <button
            type="button"
            onClick={() => {
              setType("all");
              setQuery("");
            }}
            className="mt-4 min-h-10 text-sm text-ember underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
          >
            Show all agents
          </button>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((agent) => (
            <li key={agent.id}>
              <AgentCard agent={agent} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
